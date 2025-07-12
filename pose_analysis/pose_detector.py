"""
姿态检测核心模块
包含角度计算、关键点检测等功能
"""

import cv2
import numpy as np
import torch
from ultralytics import YOLO
from typing import Tuple, List, Optional, Dict, Any
import os

class PoseDetector:
    """姿态检测器类"""
    
    def __init__(self, model_path: str = "model/yolov8s-pose.pt"):
        """
        初始化姿态检测器
        
        Args:
            model_path: YOLO模型文件路径
        """
        self.model_path = model_path
        self.model = None
        self.keypoints_dict = {
            'Nose': 0,
            'Left Eye': 1,
            'Right Eye': 2,
            'Left Ear': 3,
            'Right Ear': 4,
            'Left Shoulder': 5,
            'Right Shoulder': 6,
            'Left Elbow': 7,
            'Right Elbow': 8,
            'Left Wrist': 9,
            'Right Wrist': 10,
            'Left Hip': 11,
            'Right Hip': 12,
            'Left Knee': 13,
            'Right Knee': 14,
            'Left Ankle': 15,
            'Right Ankle': 16
        }
        
        # 关键点索引定义
        self.left_elbow_indices = [
            self.keypoints_dict['Left Wrist'], 
            self.keypoints_dict['Left Elbow'], 
            self.keypoints_dict['Left Shoulder']
        ]
        self.right_elbow_indices = [
            self.keypoints_dict['Right Wrist'], 
            self.keypoints_dict['Right Elbow'], 
            self.keypoints_dict['Right Shoulder']
        ]
        
        self.load_model()
    
    def load_model(self) -> bool:
        """
        加载YOLO模型
        
        Returns:
            bool: 加载是否成功
        """
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"模型文件不存在: {self.model_path}")
            
            self.model = YOLO(self.model_path)
            
            # 检查CUDA可用性
            import torch
            if torch.cuda.is_available():
                self.model = self.model.to('cuda')
                print(f"模型加载成功，运行在GPU: {torch.cuda.get_device_name(0)}")
            else:
                print("模型加载成功，运行在CPU")
            
            return True
            
        except Exception as e:
            print(f"模型加载失败: {str(e)}")
            return False
    
    def estimate_pose_angle(self, a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
        """
        计算三点之间的角度
        
        Args:
            a: 第一个点的坐标 [x, y]
            b: 第二个点的坐标 [x, y] (角度顶点)
            c: 第三个点的坐标 [x, y]
            
        Returns:
            float: 角度值(度)
        """
        a, b, c = np.array(a), np.array(b), np.array(c)
        radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
        angle = np.abs(radians * 180.0 / np.pi)
        if angle > 180.0:
            angle = 360 - angle
        # 确保返回Python原生的float类型，而不是numpy类型
        return float(angle)
    
    def plot_angle(self, frame: np.ndarray, angle: float, center_kpt: np.ndarray, 
                   color: Tuple[int, int, int] = (104, 31, 17), 
                   txt_color: Tuple[int, int, int] = (255, 255, 255), 
                   sf: float = 1, tf: int = 1) -> None:
        """
        在图像上绘制角度标注
        
        Args:
            frame: 输入图像
            angle: 角度值
            center_kpt: 中心关键点坐标
            color: 背景颜色
            txt_color: 文字颜色
            sf: 文字缩放因子
            tf: 文字粗细
        """
        angle_text = f" {angle:.2f}"
        
        (angle_text_width, angle_text_height), _ = cv2.getTextSize(angle_text, 0, sf, tf)
        angle_text_position = (int(center_kpt[0]), int(center_kpt[1]))
        angle_background_position = (angle_text_position[0], angle_text_position[1] - angle_text_height - 5)
        angle_background_size = (angle_text_width + 2 * 5, angle_text_height + 2 * 5 + (tf * 2))
        
        cv2.rectangle(
            frame,
            angle_background_position,
            (
                angle_background_position[0] + angle_background_size[0],
                angle_background_position[1] + angle_background_size[1],
            ),
            color,
            -1,
        )
        cv2.putText(frame, angle_text, angle_text_position, 0, sf, txt_color, tf)
    
    def calculate_front_shoulder_angle(self, frame: np.ndarray, keypoints: torch.Tensor, 
                                     show_angle: bool = False) -> Tuple[float, float]:
        """
        计算正面肩关节角度
        
        Args:
            frame: 输入图像
            keypoints: 关键点数据
            show_angle: 是否显示角度标注
            
        Returns:
            Tuple[float, float]: 左肩角度, 右肩角度
        """
        for k in keypoints:
            # 左肩角度计算
            left_elbow = k[self.keypoints_dict['Left Elbow']].cpu().numpy()
            left_shoulder = k[self.keypoints_dict['Left Shoulder']].cpu().numpy()
            left_hip = k[self.keypoints_dict['Left Hip']].cpu().numpy()
            left_angle = self.estimate_pose_angle(left_elbow, left_shoulder, left_hip)
            
            # 右肩角度计算
            right_elbow = k[self.keypoints_dict['Right Elbow']].cpu().numpy()
            right_shoulder = k[self.keypoints_dict['Right Shoulder']].cpu().numpy()
            right_hip = k[self.keypoints_dict['Right Hip']].cpu().numpy()
            right_angle = self.estimate_pose_angle(right_elbow, right_shoulder, right_hip)
            
            if show_angle:
                self.plot_angle(frame, left_angle, left_shoulder)
                self.plot_angle(frame, right_angle, right_shoulder)
            
            return left_angle, right_angle
        
        return 0.0, 0.0
    
    def calculate_side_shoulder_angle(self, frame: np.ndarray, keypoints: torch.Tensor, 
                                    show_angle: bool = False) -> Tuple[float, float]:
        """
        计算侧面肩关节角度（前屈运动）
        前屈运动：计算肩关节相对于躯干的前屈角度
        角度定义：髋关节-肩关节-肘关节的角度
        
        Args:
            frame: 输入图像
            keypoints: 关键点数据
            show_angle: 是否显示角度标注
            
        Returns:
            Tuple[float, float]: 左肩角度, 右肩角度
        """
        for k in keypoints:
            # 左肩前屈角度计算：髋关节-肩关节-肘关节
            left_hip = k[self.keypoints_dict['Left Hip']].cpu().numpy()
            left_shoulder = k[self.keypoints_dict['Left Shoulder']].cpu().numpy()
            left_elbow = k[self.keypoints_dict['Left Elbow']].cpu().numpy()
            left_angle = self.estimate_pose_angle(left_hip, left_shoulder, left_elbow)
            
            # 右肩前屈角度计算：髋关节-肩关节-肘关节
            right_hip = k[self.keypoints_dict['Right Hip']].cpu().numpy()
            right_shoulder = k[self.keypoints_dict['Right Shoulder']].cpu().numpy()
            right_elbow = k[self.keypoints_dict['Right Elbow']].cpu().numpy()
            right_angle = self.estimate_pose_angle(right_hip, right_shoulder, right_elbow)
            
            if show_angle:
                self.plot_angle(frame, left_angle, left_shoulder)
                self.plot_angle(frame, right_angle, right_shoulder)
            
            return left_angle, right_angle
        
        return 0.0, 0.0
    
    def calculate_wrist_distance(self, frame: np.ndarray, keypoints: torch.Tensor, 
                               show_distance: bool = True) -> Tuple[float, float]:
        """
        计算左右腕关键点距离两肩关节和臀关键点中轴线距离
        
        Args:
            frame: 输入图像
            keypoints: 关键点数据
            show_distance: 是否显示距离标注
            
        Returns:
            Tuple[float, float]: 左腕高度百分比, 右腕高度百分比
        """
        for k in keypoints:
            left_wrist = k[self.keypoints_dict['Left Wrist']].cpu().numpy()
            right_wrist = k[self.keypoints_dict['Right Wrist']].cpu().numpy()
            left_hip = k[self.keypoints_dict['Left Hip']].cpu().numpy()
            right_hip = k[self.keypoints_dict['Right Hip']].cpu().numpy()
            left_shoulder = k[self.keypoints_dict['Left Shoulder']].cpu().numpy()
            right_shoulder = k[self.keypoints_dict['Right Shoulder']].cpu().numpy()
            
            hip_line_center = (left_hip + right_hip) / 2
            shoulder_line_center = (left_shoulder + right_shoulder) / 2
            
            # 计算左右腕关键点距离hip_line的高度
            left_wrist_height = left_wrist[1] - hip_line_center[1]
            right_wrist_height = right_wrist[1] - hip_line_center[1]
            
            # 计算高度百分比
            base_line_length = hip_line_center[1] - shoulder_line_center[1]
            left_wrist_height_percent = abs(left_wrist_height / base_line_length)
            right_wrist_height_percent = abs(right_wrist_height / base_line_length)
            
            if show_distance:
                # 显示base_line
                cv2.line(frame, 
                        (int(shoulder_line_center[0]), int(shoulder_line_center[1])), 
                        (int(hip_line_center[0]), int(hip_line_center[1])), 
                        (0, 0, 255), 2)
                
                # 显示左右腕关键点高度
                self.plot_angle(frame, left_wrist_height_percent, left_wrist)
                self.plot_angle(frame, right_wrist_height_percent, right_wrist)
            
            # 确保返回Python原生的float类型，而不是numpy类型
            return float(left_wrist_height_percent), float(right_wrist_height_percent)
        
        return 0.0, 0.0
    
    def detect_pose(self, frame: np.ndarray, conf: float = 0.25, 
                   iou: float = 0.45, classes: List[int] = None) -> Tuple[np.ndarray, torch.Tensor]:
        """
        检测姿态关键点
        
        Args:
            frame: 输入图像
            conf: 置信度阈值
            iou: IoU阈值
            classes: 检测类别
            
        Returns:
            Tuple[np.ndarray, torch.Tensor]: 标注后的图像, 关键点数据
        """
        if self.model is None:
            raise RuntimeError("模型未加载")
        
        if classes is None:
            classes = [0]  # 默认只检测人体
        
        results = self.model(frame, conf=conf, iou=iou, classes=classes)
        annotated_frame = results[0].plot()
        keypoints = results[0].keypoints.data
        
        return annotated_frame, keypoints