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
from PIL import Image, ImageDraw, ImageFont
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
                     iou: float = 0.45, timeline_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        分析单个视频文件
        
        Args:
            video_path: 视频文件路径
            angle: 视频角度 (front/side/back)
            conf: 置信度阈值
            iou: IoU阈值
            timeline_data: 时间轴数据，包含start和end时间点
            
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
        wrist_height_data = []
        annotated_frames = []
        
        frame_count = 0
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        
        # 处理时间轴数据
        start_time = 0
        end_time = duration
        print(f"时间轴数据: {timeline_data}")
        if timeline_data:
            # timeline_data 直接就是该角度的时间轴数据
            start_time = timeline_data.get('start', 0)
            end_time = timeline_data.get('end', duration)
            print(f"时间轴设置: {angle}角度视频分析时间范围 {start_time:.2f}s - {end_time:.2f}s")
        
        # 计算开始和结束帧
        start_frame = int(start_time * fps)
        end_frame = int(end_time * fps)
        
        print(f"开始分析视频: {video_path}")
        print(f"视频FPS: {fps}, 总时长: {duration:.2f}s")
        print(f"分析帧范围: {start_frame} - {end_frame}")
        
        # 跳过开始帧之前的帧
        for _ in range(start_frame):
            cap.read()
        
        while True:
            ret, frame = cap.read()
            if not ret or frame_count >= (end_frame - start_frame):
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
                
                # 只保存选择时间段内的标注帧
                annotated_frames.append(annotated_frame.copy())
                
            except Exception as e:
                print(f"处理第{frame_count}帧时出错: {str(e)}")
                continue
        
        cap.release()
        
        # 计算速度
        if angle in ["front", "side"] and angle_data:
            velocity_data = self.data_processor.calculate_velocity(angle_data, fps)
        
        # 整理分析结果
        analysis_result = {
            'angle': angle,
            'frame_count': frame_count,
            'fps': fps,
            'duration': frame_count / fps if fps > 0 else 0,
            'total_duration': duration,  # 原始视频总时长
            'analysis_start_time': start_time,  # 分析开始时间
            'analysis_end_time': end_time,  # 分析结束时间
            'angle_data': angle_data,
            'velocity_data': velocity_data,
            'wrist_height_data': wrist_height_data,
            'annotated_frames': annotated_frames,
            'analysis_time': datetime.now().isoformat()
        }
        
        print(f"视频分析完成: {video_path}")
        print(f"分析帧数: {frame_count}, 分析时长: {frame_count/fps:.2f}s")
        
        return analysis_result
    
    def analyze_patient_videos(self, patient_id: int, patient_name: str, 
                             video_paths: Dict[str, str], conf: float = 0.25, 
                             iou: float = 0.45, stop_check_func=None,
                             patient_info: Optional[Dict[str, Any]] = None,
                             timeline_data: Optional[Dict[str, Any]] = None,
                             shoulder_selection: str = 'left') -> Dict[str, Any]:
        """
        分析患者的所有视频文件
        
        Args:
            patient_id: 患者ID
            patient_name: 患者姓名
            video_paths: 视频文件路径字典 {'front': path, 'side': path, 'back': path}
            conf: 置信度阈值
            iou: IoU阈值
            stop_check_func: 停止检查函数，返回True表示需要停止
            patient_info: 患者详细信息（年龄、性别、身高、体重等）
            timeline_data: 时间轴数据字典，格式为 {'front': {'start': 0, 'end': 10}, ...}
            shoulder_selection: 肩部选择，'left'表示左肩，'right'表示右肩
            
        Returns:
            Dict[str, Any]: 综合分析结果
        """
        print(f"开始分析患者 {patient_name} 的视频文件")
        print(f"肩部选择: {shoulder_selection}")
        
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
                # 检查是否需要停止
                if stop_check_func and stop_check_func():
                    print(f"分析被停止，正在处理{angle}角度视频")
                    break
                    
                try:
                    # 获取该角度的时间轴数据
                    angle_timeline = None
                    if timeline_data and angle in timeline_data:
                        angle_timeline = timeline_data[angle]
                        print(f"为{angle}角度设置时间轴数据: {angle_timeline}")
                    
                    result = self.analyze_video(video_path, angle, conf, iou, angle_timeline)
                    analysis_results[angle] = result
                except Exception as e:
                    print(f"分析{angle}角度视频失败: {str(e)}")
                    analysis_results[angle] = None
        
        # 检查是否需要停止
        if stop_check_func and stop_check_func():
            print("分析被停止，跳过后续处理")
            return None
        
        # 生成分析图表，传递肩部选择参数
        charts_data = self.data_processor.generate_charts(analysis_results, patient_name, shoulder_selection)
        
        # 保存图表到文件
        chart_paths = {}
        for chart_name, chart_data in charts_data.items():
            if stop_check_func and stop_check_func():
                print("分析被停止，跳过图表生成")
                break
                
            if chart_data:
                chart_path = os.path.join(analysis_dir, f"{chart_name}.png")
                chart_data.savefig(chart_path, dpi=300, bbox_inches='tight')
                plt.close(chart_data)  # 修复：使用plt.close()而不是chart_data.close()
                chart_paths[chart_name] = chart_path
        
        # 检查是否需要停止
        if stop_check_func and stop_check_func():
            print("分析被停止，跳过报告生成")
            return None
        
        # 生成关键帧图片
        keyframe_paths = {}
        if stop_check_func and stop_check_func():
            print("分析被停止，跳过关键帧图片生成")
        else:
            keyframe_paths = self.generate_keyframe_images(
                analysis_results, video_paths, analysis_dir, shoulder_selection
            )
        
        # 生成分析报告
        report_data = self.data_processor.process_analysis_data(
            analysis_results, patient_name, patient_id, patient_info
        )
        
        # 保存分析数据
        data_path = os.path.join(analysis_dir, "analysis_data.json")
        # 转换numpy类型为Python原生类型，确保JSON序列化成功
        serializable_data = convert_numpy_types(report_data)
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(serializable_data, f, ensure_ascii=False, indent=2)
        
        # 生成Word报告
        report_path = self.report_generator.generate_report(
            report_data, reports_dir, patient_name, shoulder_selection
        )
        
        # 保存标注后的视频
        video_output_paths = {}
        for angle, result in analysis_results.items():
            if result and result.get('annotated_frames'):
                # 使用患者姓名-角度的格式命名标注视频
                output_path = os.path.join(analysis_dir, f"{patient_name}-{angle}.avi")
                self.save_annotated_video(result['annotated_frames'], output_path, result['fps'])
                video_output_paths[angle] = output_path
        
        # 综合结果
        comprehensive_result = {
            'patient_id': patient_id,
            'patient_name': patient_name,
            'analysis_results': analysis_results,
            'chart_paths': chart_paths,
            'video_output_paths': video_output_paths,
            'keyframe_paths': keyframe_paths,  # 添加关键帧图片路径
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

    def _draw_chinese_text(self, image: np.ndarray, text: str, position: Tuple[int, int], 
                          font_size: int = 30, color: Tuple[int, int, int] = (255, 255, 255)) -> np.ndarray:
        """
        在图像上绘制中文文字
        
        Args:
            image: 输入图像
            text: 要绘制的文字
            position: 文字位置 (x, y)
            font_size: 字体大小
            color: 文字颜色 (R, G, B)
            
        Returns:
            np.ndarray: 绘制文字后的图像
        """
        try:
            # 转换OpenCV图像为PIL图像
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(image_rgb)
            
            # 创建绘图对象
            draw = ImageDraw.Draw(pil_image)
            
            # 尝试加载中文字体，按优先级尝试
            font = None
            font_paths = [
                "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc",  # Noto Sans CJK
                "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc",   # Noto Serif CJK
                "/usr/share/fonts/truetype/arphic/ukai.ttc",              # AR PL UKai
                "/usr/share/fonts/truetype/arphic/uming.ttc",             # AR PL UMing
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",        # DejaVu Sans
                "/System/Library/Fonts/Arial.ttf",                        # macOS Arial
                "C:/Windows/Fonts/arial.ttf",                             # Windows Arial
            ]
            
            for font_path in font_paths:
                try:
                    if os.path.exists(font_path):
                        font = ImageFont.truetype(font_path, font_size)
                        print(f"成功加载字体: {font_path}")
                        break
                except Exception as e:
                    print(f"加载字体失败 {font_path}: {e}")
                    continue
            
            # 如果所有字体都加载失败，使用默认字体
            if font is None:
                print("使用默认字体")
                font = ImageFont.load_default()
            
            # 绘制文字
            draw.text(position, text, font=font, fill=color)
            
            # 转换回OpenCV格式
            image_bgr = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            return image_bgr
            
        except Exception as e:
            print(f"绘制中文文字失败: {str(e)}")
            # 如果失败，使用OpenCV的英文文字
            cv2.putText(image, text, position, cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
            return image

    def _resize_image_for_word(self, image: np.ndarray, target_width: int = 800) -> np.ndarray:
        """
        调整图片尺寸适合Word文档
        
        Args:
            image: 输入图像
            target_width: 目标宽度（像素）
            
        Returns:
            np.ndarray: 调整后的图像
        """
        height, width = image.shape[:2]
        
        # 计算缩放比例
        scale = target_width / width
        
        # 计算新的高度
        new_height = int(height * scale)
        
        # 调整图片尺寸
        resized_image = cv2.resize(image, (target_width, new_height), interpolation=cv2.INTER_AREA)
        
        return resized_image

    def generate_keyframe_images(self, analysis_results: Dict[str, Any], video_paths: Dict[str, str], 
                               analysis_dir: str, shoulder_selection: str = 'left') -> Dict[str, str]:
        """
        生成关键帧图片
        
        Args:
            analysis_results: 分析结果字典
            video_paths: 视频文件路径字典
            analysis_dir: 分析结果保存目录
            shoulder_selection: 肩部选择，'left'表示左肩，'right'表示右肩
            
        Returns:
            Dict[str, str]: 生成的图片路径字典
        """
        keyframe_paths = {}
        
        try:
            # 1. 生成最大外展角角度视图（正面视频）
            if 'front' in analysis_results and analysis_results['front'] and 'front' in video_paths:
                front_result = analysis_results['front']
                front_video_path = video_paths['front']
                
                if front_result.get('angle_data') and os.path.exists(front_video_path):
                    keyframe_path = self._generate_max_abduction_image(
                        front_result, front_video_path, analysis_dir
                    )
                    if keyframe_path:
                        keyframe_paths['max_abduction_image'] = keyframe_path
            
            # 2. 生成最大前屈角角度视图（侧面视频）
            if 'side' in analysis_results and analysis_results['side'] and 'side' in video_paths:
                side_result = analysis_results['side']
                side_video_path = video_paths['side']
                
                if side_result.get('angle_data') and os.path.exists(side_video_path):
                    keyframe_path = self._generate_max_flexion_image(
                        side_result, side_video_path, analysis_dir, shoulder_selection
                    )
                    if keyframe_path:
                        keyframe_paths['max_flexion_image'] = keyframe_path
            
            # 3. 生成左右腕部最大高度比图（背面视频）
            if 'back' in analysis_results and analysis_results['back'] and 'back' in video_paths:
                back_result = analysis_results['back']
                back_video_path = video_paths['back']
                
                if back_result.get('wrist_height_data') and os.path.exists(back_video_path):
                    keyframe_path = self._generate_max_wrist_height_image(
                        back_result, back_video_path, analysis_dir
                    )
                    if keyframe_path:
                        keyframe_paths['max_wrist_height_image'] = keyframe_path
                        
        except Exception as e:
            print(f"生成关键帧图片时出错: {str(e)}")
        
        return keyframe_paths
    
    def _generate_max_abduction_image(self, front_result: Dict[str, Any], 
                                    video_path: str, analysis_dir: str) -> Optional[str]:
        """
        生成最大外展角角度视图
        
        Args:
            front_result: 正面分析结果
            video_path: 正面视频路径
            analysis_dir: 分析结果目录
            
        Returns:
            Optional[str]: 生成的图片路径
        """
        try:
            angle_data = front_result['angle_data']
            fps = front_result.get('fps', 30)
            analysis_start_time = front_result.get('analysis_start_time', 0)
            
            # 在后50%的帧数里找最大外展角
            half_length = len(angle_data) // 2
            second_half_data = angle_data[half_length:]
            
            # 找到左右肩最大外展角对应的帧
            left_max_frame = max(second_half_data, key=lambda x: x['left_angle'])
            right_max_frame = max(second_half_data, key=lambda x: x['right_angle'])
            
            # 计算在原始视频中的帧号
            left_max_frame_num = int(analysis_start_time * fps + left_max_frame['frame'] - 1)
            right_max_frame_num = int(analysis_start_time * fps + right_max_frame['frame'] - 1)
            
            # 从原始视频中提取对应帧
            cap = cv2.VideoCapture(video_path)
            
            # 提取左肩最大外展角帧
            cap.set(cv2.CAP_PROP_POS_FRAMES, left_max_frame_num)
            ret, left_frame = cap.read()
            
            # 提取右肩最大外展角帧
            cap.set(cv2.CAP_PROP_POS_FRAMES, right_max_frame_num)
            ret, right_frame = cap.read()
            
            cap.release()
            
            if left_frame is not None and right_frame is not None:
                # 组合左右帧
                height, width = left_frame.shape[:2]
                combined_frame = np.zeros((height, width * 2, 3), dtype=np.uint8)
                combined_frame[:, :width] = left_frame
                combined_frame[:, width:] = right_frame
                
                # 添加文字标注
                combined_frame = self._draw_chinese_text(combined_frame, f"左肩最大外展角: {left_max_frame['left_angle']:.1f}°", (10, 30))
                combined_frame = self._draw_chinese_text(combined_frame, f"右肩最大外展角: {right_max_frame['right_angle']:.1f}°", (width + 10, 30))
                
                # 调整图片尺寸适合Word文档
                combined_frame = self._resize_image_for_word(combined_frame, target_width=800)
                
                # 保存图片
                output_path = os.path.join(analysis_dir, "max_abduction_angles.png")
                cv2.imwrite(output_path, combined_frame)
                print(f"最大外展角角度视图已保存: {output_path}")
                return output_path
                
        except Exception as e:
            print(f"生成最大外展角角度视图失败: {str(e)}")
        
        return None
    
    def _generate_max_flexion_image(self, side_result: Dict[str, Any], 
                                  video_path: str, analysis_dir: str, 
                                  shoulder_selection: str) -> Optional[str]:
        """
        生成最大前屈角角度视图
        
        Args:
            side_result: 侧面分析结果
            video_path: 侧面视频路径
            analysis_dir: 分析结果目录
            shoulder_selection: 肩部选择
            
        Returns:
            Optional[str]: 生成的图片路径
        """
        try:
            angle_data = side_result['angle_data']
            fps = side_result.get('fps', 30)
            analysis_start_time = side_result.get('analysis_start_time', 0)
            
            # 在后50%的帧数里找最大前屈角
            half_length = len(angle_data) // 2
            second_half_data = angle_data[half_length:]
            
            # 根据肩部选择找到对应的最大前屈角
            if shoulder_selection == 'left':
                max_frame = max(second_half_data, key=lambda x: x['left_angle'])
                max_angle = max_frame['left_angle']
                angle_key = 'left_angle'
            else:  # right
                max_frame = max(second_half_data, key=lambda x: x['right_angle'])
                max_angle = max_frame['right_angle']
                angle_key = 'right_angle'
            
            # 计算在原始视频中的帧号
            max_frame_num = int(analysis_start_time * fps + max_frame['frame'] - 1)
            
            # 从原始视频中提取对应帧
            cap = cv2.VideoCapture(video_path)
            cap.set(cv2.CAP_PROP_POS_FRAMES, max_frame_num)
            ret, frame = cap.read()
            cap.release()
            
            if frame is not None:
                # 添加文字标注
                shoulder_text = "左肩" if shoulder_selection == 'left' else "右肩"
                frame = self._draw_chinese_text(frame, f"{shoulder_text}最大前屈角: {max_angle:.1f}°", (10, 30))
                
                # 调整图片尺寸适合Word文档
                frame = self._resize_image_for_word(frame, target_width=300)
                
                # 保存图片
                output_path = os.path.join(analysis_dir, "max_flexion_angle.png")
                cv2.imwrite(output_path, frame)
                print(f"最大前屈角角度视图已保存: {output_path}")
                return output_path
                
        except Exception as e:
            print(f"生成最大前屈角角度视图失败: {str(e)}")
        
        return None
    
    def _generate_max_wrist_height_image(self, back_result: Dict[str, Any], 
                                       video_path: str, analysis_dir: str) -> Optional[str]:
        """
        生成左右腕部最大高度比图
        
        Args:
            back_result: 背面分析结果
            video_path: 背面视频路径
            analysis_dir: 分析结果目录
            
        Returns:
            Optional[str]: 生成的图片路径
        """
        try:
            wrist_height_data = back_result['wrist_height_data']
            fps = back_result.get('fps', 30)
            analysis_start_time = back_result.get('analysis_start_time', 0)
            
            # 在后50%的帧数里找最大腕部高度
            half_length = len(wrist_height_data) // 2
            second_half_data = wrist_height_data[half_length:]
            
            # 找到左右腕最大高度对应的帧
            left_max_frame = max(second_half_data, key=lambda x: x['left_wrist_height'])
            right_max_frame = max(second_half_data, key=lambda x: x['right_wrist_height'])
            
            # 计算在原始视频中的帧号
            left_max_frame_num = int(analysis_start_time * fps + left_max_frame['frame'] - 1)
            right_max_frame_num = int(analysis_start_time * fps + right_max_frame['frame'] - 1)
            
            # 从原始视频中提取对应帧
            cap = cv2.VideoCapture(video_path)
            
            # 提取左腕最大高度帧
            cap.set(cv2.CAP_PROP_POS_FRAMES, left_max_frame_num)
            ret, left_frame = cap.read()
            
            # 提取右腕最大高度帧
            cap.set(cv2.CAP_PROP_POS_FRAMES, right_max_frame_num)
            ret, right_frame = cap.read()
            
            cap.release()
            
            if left_frame is not None and right_frame is not None:
                # 组合左右帧
                height, width = left_frame.shape[:2]
                combined_frame = np.zeros((height, width * 2, 3), dtype=np.uint8)
                combined_frame[:, :width] = left_frame
                combined_frame[:, width:] = right_frame
                
                # 添加文字标注
                combined_frame = self._draw_chinese_text(combined_frame, f"左腕最大高度: {left_max_frame['left_wrist_height']:.2f}", (10, 30))
                combined_frame = self._draw_chinese_text(combined_frame, f"右腕最大高度: {right_max_frame['right_wrist_height']:.2f}", (width + 10, 30))
                
                # 调整图片尺寸适合Word文档
                combined_frame = self._resize_image_for_word(combined_frame, target_width=800)
                
                # 保存图片
                output_path = os.path.join(analysis_dir, "max_wrist_heights.png")
                cv2.imwrite(output_path, combined_frame)
                print(f"左右腕部最大高度比图已保存: {output_path}")
                return output_path
                
        except Exception as e:
            print(f"生成左右腕部最大高度比图失败: {str(e)}")
        
        return None