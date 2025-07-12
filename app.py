from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
# 移除密码加密相关导入
from werkzeug.utils import secure_filename
import os
import sqlite3
from datetime import datetime
import yaml
from yaml.loader import SafeLoader
import cv2
import numpy as np
from ultralytics import YOLO
import json
import shutil
import threading
import time
from collections import defaultdict

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # 请更改为安全的密钥

# 配置
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///patients.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 确保患者数据目录存在
PATIENTS_DATA_DIR = 'patients_data'
os.makedirs(PATIENTS_DATA_DIR, exist_ok=True)

# 数据库模型
db = SQLAlchemy(app)

# 全局变量用于管理分析状态
analysis_tasks = {}  # 存储正在进行的分析任务
analysis_status = defaultdict(dict)  # 存储分析状态

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), default='user')

class Patient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    age = db.Column(db.Integer)
    gender = db.Column(db.String(10))
    symptoms = db.Column(db.String(100))
    duration = db.Column(db.Integer)
    treatment = db.Column(db.String(100))
    project = db.Column(db.String(100))
    ai_motion_score = db.Column(db.Float)
    ai_motion_report = db.Column(db.Text)
    ai_comprehensive_score = db.Column(db.Float)
    ai_comprehensive_report = db.Column(db.Text)
    fill_person = db.Column(db.String(100))
    record_time = db.Column(db.DateTime, default=datetime.utcnow)
    height = db.Column(db.Float)
    weight = db.Column(db.Float)
    address = db.Column(db.String(200))

# 加载用户配置
def load_config():
    with open('config.yaml') as file:
        return yaml.load(file, Loader=SafeLoader)

def delete_patient_folder(patient):
    """删除患者的文件夹及其所有内容"""
    try:
        # 创建患者文件夹名称（id-姓名格式）
        folder_name = f"{patient.id}-{patient.username}"
        # 移除文件夹名称中的特殊字符
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        folder_path = os.path.join(PATIENTS_DATA_DIR, folder_name)
        
        # 检查文件夹是否存在
        if os.path.exists(folder_path):
            # 删除整个文件夹及其内容
            shutil.rmtree(folder_path)
            return True, f"患者文件夹 {folder_name} 删除成功"
        else:
            return True, f"患者文件夹 {folder_name} 不存在，无需删除"
            
    except Exception as e:
        return False, f"删除患者文件夹失败: {str(e)}"

# 登录验证装饰器
def login_required(f):
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# 路由
@app.route('/')
def index():
    if 'user_id' in session:
        return render_template('index.html')
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        config = load_config()
        credentials = config['credentials']['usernames']
        
        if username in credentials:
            user_info = credentials[username]
            # 直接比较明文密码
            if user_info['password'] == password:
                session['user_id'] = username
                session['user_name'] = user_info['name']
                session['user_role'] = user_info.get('role', 'user')
                flash('登录成功！', 'success')
                return redirect(url_for('index'))
        
        flash('用户名或密码错误', 'error')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('已退出登录', 'info')
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        name = request.form['name']
        
        # 检查用户是否已存在
        config = load_config()
        credentials = config['credentials']['usernames']
        
        if username in credentials:
            flash('用户名已存在', 'error')
            return render_template('register.html')
        
        # 创建新用户 - 使用明文密码
        credentials[username] = {
            'email': email,
            'name': name,
            'password': password,  # 直接存储明文密码
            'role': 'user',
            'failed_login_attempts': 0,
            'logged_in': False
        }
        
        # 保存配置
        with open('config.yaml', 'w') as file:
            yaml.dump(config, file, default_flow_style=False)
        
        flash('注册成功！请登录', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/data_management')
@login_required
def data_management():
    return render_template('data_management.html')

@app.route('/ai_video')
@login_required
def ai_video():
    return render_template('ai_video.html')

@app.route('/api/patients', methods=['GET', 'POST'])
@login_required
def api_patients():
    if request.method == 'POST':
        data = request.json or {}
        # 创建患者对象并设置属性
        patient = Patient()
        patient.username = data.get('name', '')  # 使用name字段作为username
        patient.age = data.get('age')
        patient.gender = data.get('gender')
        patient.symptoms = data.get('symptoms', '')  # 肩部症状
        patient.duration = data.get('duration')
        patient.treatment = data.get('treatment', '')  # 治疗史
        patient.project = data.get('project', '')  # 研究项目
        patient.ai_motion_score = data.get('ai_motion_score')
        patient.ai_motion_report = data.get('ai_motion_report')
        patient.ai_comprehensive_score = data.get('ai_comprehensive_score')
        patient.ai_comprehensive_report = data.get('ai_comprehensive_report')
        patient.fill_person = data.get('fill_person', '')  # 填写人
        patient.height = data.get('height')
        patient.weight = data.get('weight')
        patient.address = data.get('address', '')  # 地址
        db.session.add(patient)
        db.session.commit()
        return jsonify({'success': True, 'id': patient.id})
    
    # GET请求返回患者列表
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 20, type=int)
        search = request.args.get('search', '')
        gender = request.args.get('gender', '')
        age_range = request.args.get('age_range', '')
        
        # 构建查询
        query = Patient.query
        
        # 搜索过滤
        if search:
            query = query.filter(Patient.username.like(f'%{search}%'))
        
        # 性别过滤
        if gender:
            query = query.filter(Patient.gender == gender)
        
        # 年龄范围过滤
        if age_range:
            if age_range == '0-18':
                query = query.filter(Patient.age.between(0, 18))
            elif age_range == '19-30':
                query = query.filter(Patient.age.between(19, 30))
            elif age_range == '31-50':
                query = query.filter(Patient.age.between(31, 50))
            elif age_range == '51-70':
                query = query.filter(Patient.age.between(51, 70))
            elif age_range == '71+':
                query = query.filter(Patient.age >= 71)
        
        # 分页
        total = query.count()
        patients = query.offset((page - 1) * page_size).limit(page_size).all()
        
        # 格式化返回数据
        patients_data = []
        for p in patients:
            patient_data = {
                'id': p.id,
                'name': p.username,  # 将username映射为name
                'age': p.age,
                'gender': p.gender,
                'height': p.height,
                'weight': p.weight,
                'symptoms': p.symptoms,  # 肩部症状
                'duration': p.duration,  # 持续时间
                'treatment': p.treatment,  # 治疗史
                'project': p.project,  # 研究项目
                'ai_motion_score': p.ai_motion_score,  # AI运动评分
                'ai_motion_report': p.ai_motion_report,  # AI运动报告
                'ai_comprehensive_score': p.ai_comprehensive_score,  # AI综合评分
                'ai_comprehensive_report': p.ai_comprehensive_report,  # AI综合报告
                'fill_person': p.fill_person,  # 填写人
                'record_time': p.record_time.strftime('%Y-%m-%d %H:%M:%S') if p.record_time else None,
                'address': p.address  # 地址
            }
            patients_data.append(patient_data)
        
        # 计算总页数
        total_pages = (total + page_size - 1) // page_size
        
        return jsonify({
            'success': True,
            'data': {
                'patients': patients_data,
                'total': total,
                'page': page,
                'page_size': page_size,
                'total_pages': total_pages
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'获取患者数据失败: {str(e)}'
        }), 500

@app.route('/api/patients/<int:patient_id>')
@login_required
def api_patient_detail(patient_id):
    try:
        patient = Patient.query.get_or_404(patient_id)
        return jsonify({
            'success': True,
            'data': {
                'id': patient.id,
                'name': patient.username,  # 将username映射为name
                'age': patient.age,
                'gender': patient.gender,
                'height': patient.height,
                'weight': patient.weight,
                'symptoms': patient.symptoms,  # 肩部症状
                'duration': patient.duration,  # 持续时间
                'treatment': patient.treatment,  # 治疗史
                'project': patient.project,  # 研究项目
                'ai_motion_score': patient.ai_motion_score,  # AI运动评分
                'ai_motion_report': patient.ai_motion_report,  # AI运动报告
                'ai_comprehensive_score': patient.ai_comprehensive_score,  # AI综合评分
                'ai_comprehensive_report': patient.ai_comprehensive_report,  # AI综合报告
                'fill_person': patient.fill_person,  # 填写人
                'record_time': patient.record_time.strftime('%Y-%m-%d %H:%M:%S') if patient.record_time else None,
                'address': patient.address  # 地址
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'获取患者详情失败: {str(e)}'
        }), 500

@app.route('/api/patients/<int:patient_id>', methods=['DELETE'])
@login_required
def api_delete_patient(patient_id):
    try:
        patient = Patient.query.get_or_404(patient_id)
        
        # 先删除患者文件夹
        folder_deleted, folder_message = delete_patient_folder(patient)
        
        # 删除数据库中的患者记录
        db.session.delete(patient)
        db.session.commit()
        
        # 返回删除结果
        if folder_deleted:
            return jsonify({
                'success': True, 
                'message': f'患者删除成功。{folder_message}'
            })
        else:
            # 即使文件夹删除失败，患者记录已经删除，返回警告信息
            return jsonify({
                'success': True, 
                'message': f'患者记录删除成功，但{folder_message}'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'删除患者失败: {str(e)}'}), 500

@app.route('/api/patients/<int:patient_id>', methods=['PUT'])
@login_required
def api_update_patient(patient_id):
    try:
        patient = Patient.query.get_or_404(patient_id)
        data = request.json or {}
        
        # 更新患者信息
        patient.username = data.get('name', patient.username)
        patient.age = data.get('age', patient.age)
        patient.gender = data.get('gender', patient.gender)
        patient.height = data.get('height', patient.height)
        patient.weight = data.get('weight', patient.weight)
        patient.symptoms = data.get('symptoms', patient.symptoms)  # 肩部症状
        patient.duration = data.get('duration', patient.duration)  # 持续时间
        patient.treatment = data.get('treatment', patient.treatment)  # 治疗史
        patient.project = data.get('project', patient.project)  # 研究项目
        patient.fill_person = data.get('fill_person', patient.fill_person)  # 填写人
        patient.address = data.get('address', patient.address)  # 地址
        
        db.session.commit()
        return jsonify({'success': True, 'message': '患者信息更新成功'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'更新患者信息失败: {str(e)}'}), 500

@app.route('/api/patients/select', methods=['GET'])
@login_required
def api_get_patients_for_selection():
    """获取患者列表用于选择"""
    try:
        # 获取所有患者的基本信息
        patients = Patient.query.all()
        
        patients_data = []
        for patient in patients:
            patient_data = {
                'id': patient.id,
                'name': patient.username,
                'age': patient.age,
                'gender': patient.gender,
                'record_time': patient.record_time.strftime('%Y-%m-%d %H:%M:%S') if patient.record_time else None
            }
            patients_data.append(patient_data)
        
        return jsonify({
            'success': True,
            'data': patients_data,
            'count': len(patients_data)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'获取患者列表失败: {str(e)}'
        }), 500

@app.route('/api/patients/<int:patient_id>/create_folder', methods=['POST'])
@login_required
def api_create_patient_folder(patient_id):
    """为指定患者创建数据文件夹"""
    try:
        patient = Patient.query.get_or_404(patient_id)
        
        # 创建患者文件夹名称（id-姓名格式）
        folder_name = f"{patient.id}-{patient.username}"
        # 移除文件夹名称中的特殊字符
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        folder_path = os.path.join(PATIENTS_DATA_DIR, folder_name)
        
        # 创建文件夹
        os.makedirs(folder_path, exist_ok=True)
        
        # 创建子文件夹
        subfolders = ['videos', 'analysis_results', 'reports']
        for subfolder in subfolders:
            os.makedirs(os.path.join(folder_path, subfolder), exist_ok=True)
        
        return jsonify({
            'success': True,
            'message': '患者文件夹创建成功',
            'folder_path': folder_path,
            'folder_name': folder_name
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'创建患者文件夹失败: {str(e)}'
        }), 500

@app.route('/api/patients/check_exists', methods=['GET'])
@login_required
def api_check_patients_exist():
    """检查是否存在患者记录"""
    try:
        patient_count = Patient.query.count()
        return jsonify({
            'success': True,
            'exists': patient_count > 0,
            'count': patient_count
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'检查患者记录失败: {str(e)}'
        }), 500

@app.route('/api/upload_video', methods=['POST'])
@login_required
def upload_video():
    if 'video' not in request.files:
        return jsonify({'success': False, 'message': '没有文件上传'}), 400
    
    file = request.files['video']
    angle = request.form.get('angle', 'unknown')
    patient_id = request.form.get('patientId')
    
    if file.filename == '':
        return jsonify({'success': False, 'message': '没有选择文件'}), 400
    
    if not patient_id:
        return jsonify({'success': False, 'message': '没有提供患者ID'}), 400
    
    # 验证患者是否存在
    patient = Patient.query.get(patient_id)
    if not patient:
        return jsonify({'success': False, 'message': '患者不存在'}), 400
    
    # 验证文件类型
    allowed_extensions = {'mp4', 'avi', 'mov', 'mkv'}
    if not file.filename or not ('.' in file.filename and 
            file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
        return jsonify({'success': False, 'message': '不支持的文件格式'}), 400
    
    # 验证文件大小
    if len(file.read()) > 100 * 1024 * 1024:
        file.seek(0)  # 重置文件指针
        return jsonify({'success': False, 'message': '文件大小超过100MB限制'}), 400
    file.seek(0)  # 重置文件指针
    
    try:
        # 创建患者文件夹名称
        folder_name = f"{patient.id}-{patient.username}"
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        # 患者视频目录路径
        patient_videos_dir = os.path.join(PATIENTS_DATA_DIR, folder_name, 'videos')
        os.makedirs(patient_videos_dir, exist_ok=True)
        
        # 重命名文件为标准格式
        filename = f"{angle}.mp4"
        filepath = os.path.join(patient_videos_dir, filename)
        
        # 检查文件是否已存在（用于覆盖逻辑）
        file_exists = os.path.exists(filepath)
        
        # 保存文件（覆盖现有文件）
        file.save(filepath)
        
        # 返回文件URL（用于预览）
        file_url = f"/api/patients/{patient_id}/videos/{filename}"
        
        return jsonify({
            'success': True, 
            'filename': filename, 
            'filepath': filepath,
            'url': file_url,
            'angle': angle,
            'patientId': patient_id,
            'replaced': file_exists,  # 标识是否覆盖了现有文件
            'message': '文件上传成功' + ('（覆盖了现有文件）' if file_exists else '')
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'保存文件失败: {str(e)}'}), 500

def run_analysis_task(analysis_id, patient_id, patient_name, video_paths, confidence_threshold, timeline_data=None, shoulder_selection='left'):
    """在后台线程中运行分析任务"""
    try:
        # 初始化分析状态
        analysis_status[analysis_id] = {
            'status': 'running',
            'progress': 0,
            'message': '正在初始化分析...',
            'stopped': False
        }
        
        # 导入视频分析器
        from pose_analysis.video_analyzer import VideoAnalyzer
        
        # 检查是否被停止
        if analysis_status[analysis_id]['stopped']:
            return
        
        # 创建视频分析器实例
        analysis_status[analysis_id]['progress'] = 10
        analysis_status[analysis_id]['message'] = '正在加载AI模型...'
        analyzer = VideoAnalyzer("model/yolov8s-pose.pt")
        
        # 检查是否被停止
        if analysis_status[analysis_id]['stopped']:
            return
        
        # 执行视频分析
        analysis_status[analysis_id]['progress'] = 30
        analysis_status[analysis_id]['message'] = '正在分析视频文件...'
        
        # 创建停止检查函数
        def check_stop():
            return analysis_status[analysis_id].get('stopped', False)
        
        # 获取患者详细信息
        with app.app_context():
            patient = Patient.query.get(patient_id)
            patient_info = None
            if patient:
                patient_info = {
                    'age': patient.age,
                    'gender': patient.gender,
                    'height': patient.height,
                    'weight': patient.weight,
                    'symptoms': patient.symptoms,
                    'duration': patient.duration,
                    'treatment': patient.treatment,
                    'project': patient.project,
                    'fill_person': patient.fill_person,
                    'address': patient.address
                }
        
        analysis_result = analyzer.analyze_patient_videos(
            patient_id=patient_id,
            patient_name=patient_name,
            video_paths=video_paths,
            conf=confidence_threshold,
            iou=0.45,
            stop_check_func=check_stop,
            patient_info=patient_info if patient_info else None,
            timeline_data=timeline_data if timeline_data else None,
            shoulder_selection=shoulder_selection  # 传递肩部选择参数
        )
        
        # 检查是否被停止
        if analysis_status[analysis_id]['stopped']:
            return
        
        # 检查分析结果是否为空（被停止）
        if analysis_result is None:
            analysis_status[analysis_id]['status'] = 'stopped'
            analysis_status[analysis_id]['message'] = '分析已被用户停止'
            return
        
        # 更新患者数据库中的AI评估结果
        analysis_status[analysis_id]['progress'] = 80
        analysis_status[analysis_id]['message'] = '正在保存分析结果...'
        
        # 在应用上下文中执行数据库操作
        with app.app_context():
            patient = Patient.query.get(patient_id)
            if patient and analysis_result.get('report_data', {}).get('summary'):
                summary = analysis_result['report_data']['summary']
                patient.ai_motion_score = summary.get('function_score', 0)
                patient.ai_motion_report = summary.get('function_assessment', '')
                patient.ai_comprehensive_score = summary.get('function_score', 0)
                patient.ai_comprehensive_report = summary.get('function_assessment', '')
                db.session.commit()
        
        # 导入JSON序列化器
        from pose_analysis.json_serializer import convert_numpy_types
        
        # 转换分析结果中的numpy类型
        summary = analysis_result.get('report_data', {}).get('summary', {})
        serializable_summary = convert_numpy_types(summary)
        
        # 转换文件路径为API路径
        chart_paths = {}
        for chart_name, file_path in analysis_result.get('chart_paths', {}).items():
            filename = os.path.basename(file_path)
            chart_paths[chart_name] = f"/api/patients/{patient_id}/analysis_results/{filename}"
        
        video_output_paths = {}
        for angle, file_path in analysis_result.get('video_output_paths', {}).items():
            filename = os.path.basename(file_path)
            video_output_paths[angle] = f"/api/patients/{patient_id}/analysis_results/{filename}"
        
        # 转换报告路径
        report_path = ""
        if analysis_result.get('report_path'):
            filename = os.path.basename(analysis_result['report_path'])
            report_path = f"/api/patients/{patient_id}/reports/{filename}"
        
        # 检查是否被停止
        if analysis_status[analysis_id]['stopped']:
            return
        
        # 更新最终状态
        analysis_status[analysis_id]['progress'] = 90
        analysis_status[analysis_id]['message'] = '正在生成图表...'
        
        # 等待图表文件生成完成
        time.sleep(2)  # 给图表生成一些时间
        
        # 检查图表文件是否存在
        chart_files_exist = True
        for chart_name, file_path in analysis_result.get('chart_paths', {}).items():
            if not os.path.exists(file_path):
                chart_files_exist = False
                break
        
        # 最终状态更新
        if analysis_status[analysis_id]['stopped']:
            return
        
        analysis_status[analysis_id]['progress'] = 100
        analysis_status[analysis_id]['status'] = 'completed'
        analysis_status[analysis_id]['message'] = '分析完成'
        analysis_status[analysis_id]['result'] = {
            'chartPaths': chart_paths,
            'videoOutputPaths': video_output_paths,
            'reportPath': report_path,
            'summary': serializable_summary,
            'chartFilesExist': chart_files_exist
        }
        
        # 清理任务
        if analysis_id in analysis_tasks:
            del analysis_tasks[analysis_id]
            
    except Exception as e:
        if analysis_id in analysis_status:
            analysis_status[analysis_id]['status'] = 'error'
            analysis_status[analysis_id]['message'] = f'分析失败: {str(e)}'
        if analysis_id in analysis_tasks:
            del analysis_tasks[analysis_id]

@app.route('/api/analyze_video', methods=['POST'])
@login_required
def analyze_video():
    data = request.json or {}
    
    # 获取视频信息
    videos = data.get('videos', {})
    analysis_type = data.get('analysisType', 'comprehensive')
    confidence_threshold = data.get('confidenceThreshold', 50) / 100.0  # 转换为0-1范围
    patient_id = data.get('patientId')
    shoulder_selection = data.get('shoulderSelection', 'left')  # 新增：获取肩部选择，默认左肩
    timeline_data = data.get('timelineData', {})  # 获取时间轴数据
    print(f"接收到的时间轴数据: {timeline_data}")
    print(f"接收到的肩部选择: {shoulder_selection}")
    
    if not videos:
        return jsonify({'success': False, 'message': '没有提供视频文件'}), 400
    
    if not patient_id:
        return jsonify({'success': False, 'message': '没有提供患者ID'}), 400
    
    try:
        # 验证患者是否存在
        patient = Patient.query.get(patient_id)
        if not patient:
            return jsonify({'success': False, 'message': '患者不存在'}), 404
        
        # 创建患者文件夹名称
        folder_name = f"{patient.id}-{patient.username}"
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        # 构建视频文件路径
        video_paths = {}
        for angle, video_info in videos.items():
            if video_info:
                video_filename = f"{angle}.mp4"
                video_path = os.path.join(PATIENTS_DATA_DIR, folder_name, 'videos', video_filename)
                if os.path.exists(video_path):
                    video_paths[angle] = video_path
        
        if not video_paths:
            return jsonify({'success': False, 'message': '没有找到有效的视频文件'}), 400
        
        # 生成分析ID
        analysis_id = f"analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # 启动后台分析任务
        analysis_thread = threading.Thread(
            target=run_analysis_task,
            args=(analysis_id, patient.id, patient.username, video_paths, confidence_threshold, timeline_data, shoulder_selection)  # 新增：传递肩部选择参数
        )
        analysis_thread.daemon = True
        analysis_thread.start()
        
        # 保存任务引用
        analysis_tasks[analysis_id] = analysis_thread
        
        # 返回分析ID，让前端轮询状态
        return jsonify({
            'success': True,
            'analysisId': analysis_id,
            'message': '分析已开始，请等待完成'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'分析失败: {str(e)}'}), 500

# 删除旧的模拟分析函数，使用新的真实分析功能

@app.route('/api/stop_analysis/<analysis_id>', methods=['POST'])
@login_required
def stop_analysis(analysis_id):
    """真正停止分析任务"""
    try:
        if analysis_id in analysis_tasks:
            # 标记任务为停止状态
            analysis_status[analysis_id]['stopped'] = True
            analysis_status[analysis_id]['status'] = 'stopped'
            analysis_status[analysis_id]['message'] = '分析已被用户停止'
            
            # 尝试终止线程（如果可能）
            task = analysis_tasks[analysis_id]
            if hasattr(task, 'cancel'):
                task.cancel()
            
            # 从任务列表中移除
            del analysis_tasks[analysis_id]
            
            return jsonify({
                'success': True, 
                'message': '分析已停止',
                'status': 'stopped'
            })
        else:
            return jsonify({
                'success': False, 
                'message': '未找到指定的分析任务'
            }), 404
            
    except Exception as e:
        return jsonify({
            'success': False, 
            'message': f'停止分析失败: {str(e)}'
        }), 500

@app.route('/api/analysis_status/<analysis_id>', methods=['GET'])
@login_required
def get_analysis_status(analysis_id):
    """获取分析状态"""
    try:
        if analysis_id in analysis_status:
            return jsonify({
                'success': True,
                'status': analysis_status[analysis_id]
            })
        else:
            return jsonify({
                'success': False,
                'message': '未找到指定的分析任务'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'获取状态失败: {str(e)}'
        }), 500

@app.route('/api/export_results/<analysis_id>', methods=['GET'])
@login_required
def export_results(analysis_id):
    # 模拟导出结果
    from io import BytesIO
    import zipfile
    
    # 创建ZIP文件
    memory_file = BytesIO()
    with zipfile.ZipFile(memory_file, 'w') as zf:
        # 添加分析报告
        report_content = f"""
        肩关节体格检查分析报告
        分析ID: {analysis_id}
        时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        
        综合分析结果:
        - 综合评分: 85/100
        - 评估结果: 运动功能正常
        - 建议: 继续保持当前运动习惯
        
        详细数据请查看附件。
        """
        zf.writestr('analysis_report.txt', report_content)
    
    memory_file.seek(0)
    
    from flask import send_file
    return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'analysis_results_{analysis_id}.zip'
    )

@app.route('/api/patients/<int:patient_id>/analysis_results', methods=['GET'])
@login_required
def get_patient_analysis_results(patient_id):
    """获取患者的分析结果"""
    try:
        patient = Patient.query.get_or_404(patient_id)
        
        # 创建患者文件夹名称
        folder_name = f"{patient.id}-{patient.username}"
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        # 分析结果目录
        analysis_dir = os.path.join(PATIENTS_DATA_DIR, folder_name, 'analysis_results')
        reports_dir = os.path.join(PATIENTS_DATA_DIR, folder_name, 'reports')
        
        results = {
            'success': True,
            'patient_id': patient_id,
            'patient_name': patient.username,
            'analysis_results': {},
            'reports': []
        }
        
        # 检查分析结果文件
        if os.path.exists(analysis_dir):
            # 获取图表文件
            chart_files = []
            for file in os.listdir(analysis_dir):
                if file.endswith('.png'):
                    chart_files.append({
                        'name': file,
                        'url': f"/api/patients/{patient_id}/analysis_results/{file}"
                    })
            results['analysis_results']['charts'] = chart_files
            
            # 获取分析数据
            data_file = os.path.join(analysis_dir, 'analysis_data.json')
            if os.path.exists(data_file):
                with open(data_file, 'r', encoding='utf-8') as f:
                    import json
                    results['analysis_results']['data'] = json.load(f)
            
            # 获取标注视频
            video_files = []
            for file in os.listdir(analysis_dir):
                # 新的命名格式：患者姓名-角度.avi
                if file.endswith('.avi') and '-' in file and not file.endswith('_annotated.avi'):
                    video_files.append({
                        'name': file,
                        'url': f"/api/patients/{patient_id}/analysis_results/{file}"
                    })
            results['analysis_results']['videos'] = video_files
        
        # 检查报告文件
        if os.path.exists(reports_dir):
            for file in os.listdir(reports_dir):
                if file.endswith('.docx'):
                    results['reports'].append({
                        'name': file,
                        'url': f"/api/patients/{patient_id}/reports/{file}"
                    })
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'获取分析结果失败: {str(e)}'}), 500

@app.route('/api/patients/<int:patient_id>/analysis_results/<filename>')
@login_required
def get_analysis_result_file(patient_id, filename):
    """获取分析结果文件"""
    try:
        patient = Patient.query.get_or_404(patient_id)
        
        # 创建患者文件夹名称
        folder_name = f"{patient.id}-{patient.username}"
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        # 分析结果目录
        analysis_dir = os.path.join(PATIENTS_DATA_DIR, folder_name, 'analysis_results')
        file_path = os.path.join(analysis_dir, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'message': '文件不存在'}), 404
        
        return send_from_directory(analysis_dir, filename)
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'获取文件失败: {str(e)}'}), 500

@app.route('/api/patients/<int:patient_id>/reports/<filename>')
@login_required
def get_patient_report(patient_id, filename):
    """获取患者报告文件"""
    try:
        patient = Patient.query.get_or_404(patient_id)
        
        # 创建患者文件夹名称
        folder_name = f"{patient.id}-{patient.username}"
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        # 报告目录
        reports_dir = os.path.join(PATIENTS_DATA_DIR, folder_name, 'reports')
        file_path = os.path.join(reports_dir, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'message': '报告文件不存在'}), 404
        
        return send_from_directory(reports_dir, filename)
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'获取报告失败: {str(e)}'}), 500

@app.route('/api/patients/<int:patient_id>/videos/<filename>')
@login_required
def api_patient_video(patient_id, filename):
    """提供患者视频文件访问"""
    try:
        patient = Patient.query.get_or_404(patient_id)
        
        # 创建患者文件夹名称
        folder_name = f"{patient.id}-{patient.username}"
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        # 患者视频目录路径
        patient_videos_dir = os.path.join(PATIENTS_DATA_DIR, folder_name, 'videos')
        video_path = os.path.join(patient_videos_dir, filename)
        
        if not os.path.exists(video_path):
            return jsonify({'success': False, 'message': '视频文件不存在'}), 404
        
        return send_from_directory(patient_videos_dir, filename)
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'获取视频文件失败: {str(e)}'}), 500

@app.route('/api/patients/<int:patient_id>/videos/check', methods=['GET'])
@login_required
def api_check_patient_videos(patient_id):
    """检查患者是否已有视频文件"""
    try:
        patient = Patient.query.get_or_404(patient_id)
        
        # 创建患者文件夹名称
        folder_name = f"{patient.id}-{patient.username}"
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        # 患者视频目录路径
        patient_videos_dir = os.path.join(PATIENTS_DATA_DIR, folder_name, 'videos')
        
        # 检查三个角度的视频文件是否存在
        video_files = {
            'front': os.path.exists(os.path.join(patient_videos_dir, 'front.mp4')),
            'side': os.path.exists(os.path.join(patient_videos_dir, 'side.mp4')),
            'back': os.path.exists(os.path.join(patient_videos_dir, 'back.mp4'))
        }
        
        # 生成视频URL
        video_urls = {}
        for angle, exists in video_files.items():
            if exists:
                video_urls[angle] = f"/api/patients/{patient_id}/videos/{angle}.mp4"
        
        return jsonify({
            'success': True,
            'videos': video_files,
            'urls': video_urls,
            'allExist': all(video_files.values())
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'检查视频文件失败: {str(e)}'}), 500

@app.route('/api/patients/<int:patient_id>/videos/<filename>', methods=['DELETE'])
@login_required
def api_delete_patient_video(patient_id, filename):
    """删除患者视频文件"""
    try:
        patient = Patient.query.get_or_404(patient_id)
        
        # 创建患者文件夹名称
        folder_name = f"{patient.id}-{patient.username}"
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        # 患者视频目录路径
        patient_videos_dir = os.path.join(PATIENTS_DATA_DIR, folder_name, 'videos')
        video_path = os.path.join(patient_videos_dir, filename)
        
        if not os.path.exists(video_path):
            return jsonify({'success': False, 'message': '视频文件不存在'}), 404
        
        # 删除文件
        os.remove(video_path)
        
        return jsonify({
            'success': True,
            'message': '视频文件删除成功'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'删除视频文件失败: {str(e)}'}), 500

@app.route('/api/patients/<int:patient_id>/analysis_history', methods=['GET'])
@login_required
def api_get_patient_analysis_history(patient_id):
    """获取患者的分析历史记录（报告文件）"""
    try:
        patient = Patient.query.get_or_404(patient_id)
        
        # 创建患者文件夹名称
        folder_name = f"{patient.id}-{patient.username}"
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        # 报告目录
        reports_dir = os.path.join(PATIENTS_DATA_DIR, folder_name, 'reports')
        
        history_records = []
        
        if os.path.exists(reports_dir):
            # 获取所有.docx文件
            for filename in os.listdir(reports_dir):
                if filename.endswith('.docx'):
                    file_path = os.path.join(reports_dir, filename)
                    file_stat = os.stat(file_path)
                    
                    # 从文件名解析信息
                    # 格式: report-张三-2025-07-08-14-01-28.docx
                    file_info = filename.replace('.docx', '').split('-')
                    if len(file_info) >= 6:
                        # 提取日期时间信息
                        date_str = '-'.join(file_info[2:5])  # 2025-07-08
                        time_str = '-'.join(file_info[5:8])  # 14-01-28
                        datetime_str = f"{date_str} {time_str.replace('-', ':')}"
                        
                        # 尝试解析时间
                        try:
                            from datetime import datetime
                            parsed_time = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
                            formatted_time = parsed_time.strftime('%Y-%m-%d %H:%M:%S')
                        except:
                            # 如果解析失败，使用文件修改时间
                            formatted_time = datetime.fromtimestamp(file_stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        # 使用文件修改时间
                        formatted_time = datetime.fromtimestamp(file_stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                    
                    record = {
                        'filename': filename,
                        'file_path': file_path,
                        'file_size': file_stat.st_size,
                        'modified_time': formatted_time,
                        'download_url': f"/api/patients/{patient_id}/reports/{filename}",
                        'analysis_type': 'comprehensive',  # 默认为综合分析
                        'status': 'completed',  # 报告已生成
                        'confidence': 'N/A'  # 报告中没有置信度信息
                    }
                    history_records.append(record)
            
            # 按时间倒序排列（最新的在前）
            history_records.sort(key=lambda x: x['modified_time'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': {
                'patient_id': patient_id,
                'patient_name': patient.username,
                'history_records': history_records,
                'total_count': len(history_records)
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'获取分析历史失败: {str(e)}'}), 500

@app.route('/api/patients/<int:patient_id>/reports/<filename>', methods=['DELETE'])
@login_required
def api_delete_patient_report(patient_id, filename):
    """删除患者的报告文件"""
    try:
        patient = Patient.query.get_or_404(patient_id)
        
        # 创建患者文件夹名称
        folder_name = f"{patient.id}-{patient.username}"
        folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
        
        # 报告目录
        reports_dir = os.path.join(PATIENTS_DATA_DIR, folder_name, 'reports')
        report_path = os.path.join(reports_dir, filename)
        
        # 检查文件是否存在
        if not os.path.exists(report_path):
            return jsonify({'success': False, 'message': '报告文件不存在'}), 404
        
        # 检查文件是否为.docx格式
        if not filename.endswith('.docx'):
            return jsonify({'success': False, 'message': '只能删除Word格式的报告文件'}), 400
        
        # 删除文件
        os.remove(report_path)
        
        return jsonify({
            'success': True,
            'message': f'报告文件 {filename} 删除成功'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'删除报告文件失败: {str(e)}'}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5050) 