"""
JSON序列化器模块
处理numpy数据类型和特殊对象的JSON序列化
"""

import json
import numpy as np
from typing import Any, Dict, List, Union
from datetime import datetime

class NumpyEncoder(json.JSONEncoder):
    """处理numpy数据类型的JSON编码器"""
    
    def default(self, obj: Any) -> Any:
        """处理numpy数据类型"""
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif hasattr(obj, 'tolist'):  # 处理其他可能有tolist方法的对象
            return obj.tolist()
        else:
            return super().default(obj)

def serialize_data(data: Any) -> str:
    """
    序列化数据为JSON字符串
    
    Args:
        data: 要序列化的数据
        
    Returns:
        str: JSON字符串
    """
    return json.dumps(data, cls=NumpyEncoder, ensure_ascii=False, indent=2)

def deserialize_data(json_str: str) -> Any:
    """
    反序列化JSON字符串为Python对象
    
    Args:
        json_str: JSON字符串
        
    Returns:
        Any: Python对象
    """
    return json.loads(json_str)

def convert_numpy_types(obj: Any) -> Any:
    """
    递归转换对象中的numpy类型为Python原生类型
    
    Args:
        obj: 要转换的对象
        
    Returns:
        Any: 转换后的对象
    """
    if isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif hasattr(obj, 'tolist'):  # 处理其他可能有tolist方法的对象
        return obj.tolist()
    else:
        return obj 