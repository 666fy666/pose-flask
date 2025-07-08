"""
工具模块
包含通用功能函数
"""

import os
import cv2
import numpy as np
from typing import List, Tuple, Optional
import json
from datetime import datetime

def ensure_directory_exists(directory_path: str) -> None:
    """
    确保目录存在，如果不存在则创建
    
    Args:
        directory_path: 目录路径
    """
    if not os.path.exists(directory_path):
        os.makedirs(directory_path, exist_ok=True)

def sanitize_filename(filename: str) -> str:
    """
    清理文件名，移除特殊字符
    
    Args:
        filename: 原始文件名
        
    Returns:
        str: 清理后的文件名
    """
    # 移除或替换特殊字符
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        filename = filename.replace(char, '_')
    return filename

def get_video_info(video_path: str) -> dict:
    """
    获取视频文件信息
    
    Args:
        video_path: 视频文件路径
        
    Returns:
        dict: 视频信息字典
    """
    if not os.path.exists(video_path):
        return None
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    
    info = {
        'width': int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        'height': int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        'fps': cap.get(cv2.CAP_PROP_FPS),
        'frame_count': int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        'duration': 0,
        'file_size': os.path.getsize(video_path)
    }
    
    if info['fps'] > 0:
        info['duration'] = info['frame_count'] / info['fps']
    
    cap.release()
    return info

def save_json_data(data: dict, file_path: str) -> bool:
    """
    保存JSON数据到文件
    
    Args:
        data: 要保存的数据
        file_path: 文件路径
        
    Returns:
        bool: 保存是否成功
    """
    try:
        ensure_directory_exists(os.path.dirname(file_path))
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存JSON数据失败: {str(e)}")
        return False

def load_json_data(file_path: str) -> Optional[dict]:
    """
    从文件加载JSON数据
    
    Args:
        file_path: 文件路径
        
    Returns:
        Optional[dict]: 加载的数据，失败返回None
    """
    try:
        if not os.path.exists(file_path):
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"加载JSON数据失败: {str(e)}")
        return None

def calculate_angle_between_points(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
    """
    计算三点之间的角度
    
    Args:
        p1: 第一个点 [x, y]
        p2: 第二个点 [x, y] (角度顶点)
        p3: 第三个点 [x, y]
        
    Returns:
        float: 角度值(度)
    """
    p1, p2, p3 = np.array(p1), np.array(p2), np.array(p3)
    
    # 计算向量
    v1 = p1 - p2
    v2 = p3 - p2
    
    # 计算角度
    cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
    cos_angle = np.clip(cos_angle, -1.0, 1.0)  # 防止数值误差
    angle = np.arccos(cos_angle) * 180.0 / np.pi
    
    return angle

def apply_smoothing_filter(data: List[float], window_size: int = 5) -> List[float]:
    """
    应用平滑滤波器
    
    Args:
        data: 原始数据
        window_size: 窗口大小
        
    Returns:
        List[float]: 平滑后的数据
    """
    if len(data) < window_size:
        return data
    
    smoothed_data = []
    half_window = window_size // 2
    
    for i in range(len(data)):
        start_idx = max(0, i - half_window)
        end_idx = min(len(data), i + half_window + 1)
        window_data = data[start_idx:end_idx]
        smoothed_data.append(sum(window_data) / len(window_data))
    
    return smoothed_data

def normalize_data(data: List[float]) -> List[float]:
    """
    数据归一化
    
    Args:
        data: 原始数据
        
    Returns:
        List[float]: 归一化后的数据
    """
    if not data:
        return data
    
    data_array = np.array(data)
    min_val = np.min(data_array)
    max_val = np.max(data_array)
    
    if max_val == min_val:
        return [0.5] * len(data)
    
    normalized = (data_array - min_val) / (max_val - min_val)
    return normalized.tolist()

def create_timestamp() -> str:
    """
    创建时间戳字符串
    
    Returns:
        str: 时间戳字符串
    """
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def format_duration(seconds: float) -> str:
    """
    格式化时长显示
    
    Args:
        seconds: 秒数
        
    Returns:
        str: 格式化的时长字符串
    """
    if seconds < 60:
        return f"{seconds:.1f}秒"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}分钟"
    else:
        hours = seconds / 3600
        return f"{hours:.1f}小时"

def validate_video_file(file_path: str) -> Tuple[bool, str]:
    """
    验证视频文件
    
    Args:
        file_path: 视频文件路径
        
    Returns:
        Tuple[bool, str]: (是否有效, 错误信息)
    """
    if not os.path.exists(file_path):
        return False, "文件不存在"
    
    # 检查文件大小
    file_size = os.path.getsize(file_path)
    max_size = 100 * 1024 * 1024  # 100MB
    if file_size > max_size:
        return False, f"文件大小超过限制({format_duration(max_size)})"
    
    # 检查文件格式
    allowed_extensions = {'.mp4', '.avi', '.mov', '.mkv'}
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext not in allowed_extensions:
        return False, f"不支持的文件格式: {file_ext}"
    
    # 尝试打开视频文件
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        return False, "无法打开视频文件"
    
    # 检查是否有帧
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        return False, "视频文件损坏或无有效帧"
    
    return True, "文件有效"

def draw_text_on_image(image: np.ndarray, text: str, position: Tuple[int, int], 
                      font_scale: float = 1.0, color: Tuple[int, int, int] = (255, 255, 255),
                      thickness: int = 2, background_color: Tuple[int, int, int] = (0, 0, 0)) -> np.ndarray:
    """
    在图像上绘制文本
    
    Args:
        image: 输入图像
        text: 要绘制的文本
        position: 文本位置 (x, y)
        font_scale: 字体缩放
        color: 文本颜色
        thickness: 文本粗细
        background_color: 背景颜色
        
    Returns:
        np.ndarray: 绘制文本后的图像
    """
    # 获取文本大小
    (text_width, text_height), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
    
    # 计算背景矩形位置
    x, y = position
    bg_x1 = x
    bg_y1 = y - text_height - baseline - 5
    bg_x2 = x + text_width + 10
    bg_y2 = y + baseline + 5
    
    # 绘制背景矩形
    cv2.rectangle(image, (bg_x1, bg_y1), (bg_x2, bg_y2), background_color, -1)
    
    # 绘制文本
    cv2.putText(image, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, thickness)
    
    return image