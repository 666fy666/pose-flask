"""
视频分析器模块
负责处理视频文件并进行分析
"""

import cv2
import numpy as np
import os
import matplotlib.pyplot as plt
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
import json
from .pose_detector import PoseDetector
from .data_processor import DataProcessor
from .report_generator import ReportGenerator
from .json_serializer import serialize_data, convert_numpy_types
from .font_config import setup_chinese_font

class VideoAnalyzer:
    """视频分析器类"""
    
    def __init__(self, model_path: str = "model/yolov8s-pose.pt"):
        """
        初始化视频分析器
        
        Args:
            model_path: YOLO模型文件路径
        """
        # 设置中文字体支持
        setup_chinese_font()
        
        self.pose_detector = PoseDetector(model_path)
        self.data_processor = DataProcessor()
        self.report_generator = ReportGenerator()
        
    def analyze_video(self, video_path: str, angle: str, conf: float = 0.25, 
                     iou: float = 0.45) -> Dict[str, Any]:
        """
        分析单个视频文件
        
        Args:
            video_path: 视频文件路径
            angle: 视频角度 (front/side/back)
            conf: 置信度阈值
            iou: IoU阈值
            
        Returns:
            Dict[str, Any]: 分析结果
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"视频文件不存在: {video_path}")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"无法打开视频文件: {video_path}")
        
        # 初始化数据列表
        angle_data = []
        velocity_data = []
        acceleration_data = []
        wrist_height_data = []
        annotated_frames = []
        
        frame_count = 0
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        print(f"开始分析视频: {video_path}")
        print(f"视频FPS: {fps}")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            
            try:
                # 检测姿态
                annotated_frame, keypoints = self.pose_detector.detect_pose(
                    frame, conf=conf, iou=iou
                )
                
                # 根据角度计算不同的指标
                if angle == "front":
                    left_angle, right_angle = self.pose_detector.calculate_front_shoulder_angle(
                        annotated_frame, keypoints, show_angle=True
                    )
                    angle_data.append({
                        'frame': frame_count,
                        'left_angle': left_angle,
                        'right_angle': right_angle
                    })
                    
                elif angle == "side":
                    left_angle, right_angle = self.pose_detector.calculate_side_shoulder_angle(
                        annotated_frame, keypoints, show_angle=True
                    )
                    angle_data.append({
                        'frame': frame_count,
                        'left_angle': left_angle,
                        'right_angle': right_angle
                    })
                    
                elif angle == "back":
                    left_wrist_height, right_wrist_height = self.pose_detector.calculate_wrist_distance(
                        annotated_frame, keypoints, show_distance=True
                    )
                    wrist_height_data.append({
                        'frame': frame_count,
                        'left_wrist_height': left_wrist_height,
                        'right_wrist_height': right_wrist_height
                    })
                
                # 保存所有标注后的帧，确保视频时长与原视频一致
                annotated_frames.append(annotated_frame.copy())
                
            except Exception as e:
                print(f"处理第{frame_count}帧时出错: {str(e)}")
                continue
        
        cap.release()
        
        # 计算速度和加速度
        if angle in ["front", "side"] and angle_data:
            velocity_data = self.data_processor.calculate_velocity(angle_data)
            acceleration_data = self.data_processor.calculate_acceleration(velocity_data)
        
        # 整理分析结果
        analysis_result = {
            'angle': angle,
            'frame_count': frame_count,
            'fps': fps,
            'duration': frame_count / fps if fps > 0 else 0,
            'angle_data': angle_data,
            'velocity_data': velocity_data,
            'acceleration_data': acceleration_data,
            'wrist_height_data': wrist_height_data,
            'annotated_frames': annotated_frames,
            'analysis_time': datetime.now().isoformat()
        }
        
        print(f"视频分析完成: {video_path}")
        print(f"总帧数: {frame_count}")
        
        return analysis_result
    
    def analyze_patient_videos(self, patient_id: int, patient_name: str, 
                             video_paths: Dict[str, str], conf: float = 0.25, 
                             iou: float = 0.45) -> Dict[str, Any]:
        """
        分析患者的所有视频文件
        
        Args:
            patient_id: 患者ID
            patient_name: 患者姓名
            video_paths: 视频文件路径字典 {'front': path, 'side': path, 'back': path}
            conf: 置信度阈值
            iou: IoU阈值
            
        Returns:
            Dict[str, Any]: 综合分析结果
        """
        print(f"开始分析患者 {patient_name} 的视频文件")
        
        # 创建患者数据目录
        patient_folder = f"{patient_id}-{patient_name}"
        patient_folder = "".join(c for c in patient_folder if c.isalnum() or c in ('-', '_'))
        
        analysis_dir = os.path.join("patients_data", patient_folder, "analysis_results")
        reports_dir = os.path.join("patients_data", patient_folder, "reports")
        
        os.makedirs(analysis_dir, exist_ok=True)
        os.makedirs(reports_dir, exist_ok=True)
        
        # 分析各个角度的视频
        analysis_results = {}
        for angle, video_path in video_paths.items():
            if video_path and os.path.exists(video_path):
                try:
                    result = self.analyze_video(video_path, angle, conf, iou)
                    analysis_results[angle] = result
                except Exception as e:
                    print(f"分析{angle}角度视频失败: {str(e)}")
                    analysis_results[angle] = None
        
        # 生成分析图表
        charts_data = self.data_processor.generate_charts(analysis_results, patient_name)
        
        # 保存图表到文件
        chart_paths = {}
        for chart_name, chart_data in charts_data.items():
            if chart_data:
                chart_path = os.path.join(analysis_dir, f"{chart_name}.png")
                chart_data.savefig(chart_path, dpi=300, bbox_inches='tight')
                plt.close(chart_data)  # 修复：使用plt.close()而不是chart_data.close()
                chart_paths[chart_name] = chart_path
        
        # 生成分析报告
        report_data = self.data_processor.process_analysis_data(
            analysis_results, patient_name, patient_id
        )
        
        # 保存分析数据
        data_path = os.path.join(analysis_dir, "analysis_data.json")
        # 转换numpy类型为Python原生类型，确保JSON序列化成功
        serializable_data = convert_numpy_types(report_data)
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(serializable_data, f, ensure_ascii=False, indent=2)
        
        # 生成Word报告
        report_path = self.report_generator.generate_report(
            report_data, reports_dir, patient_name
        )
        
        # 保存标注后的视频
        video_output_paths = {}
        for angle, result in analysis_results.items():
            if result and result.get('annotated_frames'):
                output_path = os.path.join(analysis_dir, f"{angle}_annotated.avi")
                self.save_annotated_video(result['annotated_frames'], output_path, result['fps'])
                video_output_paths[angle] = output_path
        
        # 综合结果
        comprehensive_result = {
            'patient_id': patient_id,
            'patient_name': patient_name,
            'analysis_results': analysis_results,
            'chart_paths': chart_paths,
            'video_output_paths': video_output_paths,
            'report_data': report_data,
            'report_path': report_path,
            'analysis_time': datetime.now().isoformat()
        }
        
        print(f"患者 {patient_name} 的视频分析完成")
        return comprehensive_result
    
    def save_annotated_video(self, frames: List[np.ndarray], output_path: str, fps: float) -> None:
        """
        保存标注后的视频
        
        Args:
            frames: 标注后的帧列表
            output_path: 输出视频路径
            fps: 帧率
        """
        if not frames:
            return
        
        height, width = frames[0].shape[:2]
        
        # 使用XVID编码器保存AVI格式视频
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        # 写入所有帧
        for frame in frames:
            out.write(frame)
        
        out.release()
        print(f"标注视频已保存: {output_path}")
        print(f"视频信息: {len(frames)}帧, 帧率: {fps:.2f} FPS, 时长: {len(frames)/fps:.2f}秒")