"""
分析配置文件
管理模型路径、分析参数等
"""

import os

# 模型配置
MODEL_CONFIG = {
    'default_model': 'yolov8s-pose.pt',
    'model_path': 'model',
    'available_models': [
        'yolov8n-pose.pt',
        'yolov8s-pose.pt', 
        'yolov8m-pose.pt',
        'yolov8l-pose.pt',
        'yolov8x-pose.pt'
    ]
}

# 分析参数配置
ANALYSIS_CONFIG = {
    'default_confidence': 0.25,
    'default_iou': 0.45,
    'frame_skip': 1,  # 不跳过帧，处理所有帧
    'moving_average_window': 6,
    'chart_dpi': 300,
    'chart_format': 'png'
}

# 文件路径配置
PATH_CONFIG = {
    'patients_data_dir': 'patients_data',
    'analysis_results_dir': 'analysis_results',
    'reports_dir': 'reports',
    'videos_dir': 'videos'
}

# 关键点配置
KEYPOINTS_CONFIG = {
    'nose': 0,
    'left_eye': 1,
    'right_eye': 2,
    'left_ear': 3,
    'right_ear': 4,
    'left_shoulder': 5,
    'right_shoulder': 6,
    'left_elbow': 7,
    'right_elbow': 8,
    'left_wrist': 9,
    'right_wrist': 10,
    'left_hip': 11,
    'right_hip': 12,
    'left_knee': 13,
    'right_knee': 14,
    'left_ankle': 15,
    'right_ankle': 16
}

# 角度分析配置
ANGLE_CONFIG = {
    'stages': [
        (0, 45),
        (45, 90), 
        (90, 135),
        (135, 180)
    ],
    'stage_names': [
        '0-45°',
        '45-90°',
        '90-135°', 
        '135-180°'
    ]
}

# 评估标准配置
ASSESSMENT_CONFIG = {
    'excellent_score': 85,
    'good_score': 70,
    'poor_score': 60,
    'assessments': {
        'excellent': {
            'description': '肩关节运动功能正常，活动度良好，无明显异常。',
            'recommendations': [
                '继续保持当前运动习惯',
                '定期进行肩关节保健运动',
                '注意运动时的正确姿势'
            ]
        },
        'good': {
            'description': '肩关节运动功能基本正常，存在轻微活动受限，建议进一步观察。',
            'recommendations': [
                '进行肩关节柔韧性训练',
                '避免过度使用肩关节',
                '定期进行功能评估'
            ]
        },
        'poor': {
            'description': '肩关节运动功能异常，存在明显活动受限，建议及时就医。',
            'recommendations': [
                '立即停止剧烈运动',
                '咨询专业医生进行详细检查',
                '制定个性化康复计划'
            ]
        }
    }
}

def get_model_path(model_name: str = None) -> str:
    """
    获取模型文件路径
    
    Args:
        model_name: 模型名称，如果为None则使用默认模型
        
    Returns:
        str: 模型文件完整路径
    """
    if model_name is None:
        model_name = MODEL_CONFIG['default_model']
    
    return os.path.join(MODEL_CONFIG['model_path'], model_name)

def get_patient_folder_path(patient_id: int, patient_name: str) -> str:
    """
    获取患者文件夹路径
    
    Args:
        patient_id: 患者ID
        patient_name: 患者姓名
        
    Returns:
        str: 患者文件夹路径
    """
    folder_name = f"{patient_id}-{patient_name}"
    folder_name = "".join(c for c in folder_name if c.isalnum() or c in ('-', '_'))
    return os.path.join(PATH_CONFIG['patients_data_dir'], folder_name)

def get_analysis_results_path(patient_id: int, patient_name: str) -> str:
    """
    获取患者分析结果目录路径
    
    Args:
        patient_id: 患者ID
        patient_name: 患者姓名
        
    Returns:
        str: 分析结果目录路径
    """
    patient_folder = get_patient_folder_path(patient_id, patient_name)
    return os.path.join(patient_folder, PATH_CONFIG['analysis_results_dir'])

def get_reports_path(patient_id: int, patient_name: str) -> str:
    """
    获取患者报告目录路径
    
    Args:
        patient_id: 患者ID
        patient_name: 患者姓名
        
    Returns:
        str: 报告目录路径
    """
    patient_folder = get_patient_folder_path(patient_id, patient_name)
    return os.path.join(patient_folder, PATH_CONFIG['reports_dir'])

def get_videos_path(patient_id: int, patient_name: str) -> str:
    """
    获取患者视频目录路径
    
    Args:
        patient_id: 患者ID
        patient_name: 患者姓名
        
    Returns:
        str: 视频目录路径
    """
    patient_folder = get_patient_folder_path(patient_id, patient_name)
    return os.path.join(patient_folder, PATH_CONFIG['videos_dir'])