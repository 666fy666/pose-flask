"""
数据处理模块
负责计算速度、生成图表等
"""

import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
import os
from .font_config import setup_chinese_font, get_font_properties

class DataProcessor:
    """数据处理器类"""
    
    def __init__(self):
        """初始化数据处理器"""
        # 设置中文字体支持
        setup_chinese_font()
    
    def calculate_velocity(self, angle_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        计算角速度
        
        Args:
            angle_data: 角度数据列表
            
        Returns:
            List[Dict[str, Any]]: 速度数据列表
        """
        velocity_data = []
        
        for i in range(1, len(angle_data)):
            prev_frame = angle_data[i-1]
            curr_frame = angle_data[i]
            
            left_velocity = curr_frame['left_angle'] - prev_frame['left_angle']
            right_velocity = curr_frame['right_angle'] - prev_frame['right_angle']
            
            velocity_data.append({
                'frame': curr_frame['frame'],
                'left_velocity': left_velocity,
                'right_velocity': right_velocity
            })
        
        return velocity_data
    
    def apply_moving_average(self, data: List[float], window_size: int = 6) -> List[float]:
        """
        应用移动平均滤波
        
        Args:
            data: 原始数据
            window_size: 窗口大小
            
        Returns:
            List[float]: 滤波后的数据
        """
        if len(data) < window_size:
            return data
        
        filtered_data = []
        for i in range(len(data)):
            start_idx = max(0, i - window_size + 1)
            window_data = data[start_idx:i+1]
            filtered_data.append(sum(window_data) / len(window_data))
        
        return filtered_data
    
    def generate_charts(self, analysis_results: Dict[str, Any], patient_name: str, shoulder_selection: str = 'left') -> Dict[str, plt.Figure]:
        """
        生成分析图表
        
        Args:
            analysis_results: 分析结果
            patient_name: 患者姓名
            shoulder_selection: 肩部选择，'left'表示左肩，'right'表示右肩
            
        Returns:
            Dict[str, plt.Figure]: 图表字典
        """
        charts = {}
        
        # 处理前视和侧视数据
        for angle in ['front', 'side']:
            if angle in analysis_results and analysis_results[angle]:
                result = analysis_results[angle]
                
                if result.get('angle_data'):
                    # 提取数据
                    frames = [d['frame'] for d in result['angle_data']]
                    left_angles = [d['left_angle'] for d in result['angle_data']]
                    right_angles = [d['right_angle'] for d in result['angle_data']]
                    
                    # 应用滤波
                    left_angles_filtered = self.apply_moving_average(left_angles)
                    right_angles_filtered = self.apply_moving_average(right_angles)
                    
                    # 生成角度-时间图
                    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
                    
                    # 根据肩部选择决定显示哪些曲线
                    if angle == 'side' and shoulder_selection == 'left':
                        # 侧面角度且选择左肩：只显示左肩曲线
                        ax1.plot(frames, left_angles_filtered, 'b-', linewidth=2, label='左肩')
                        ax1.set_xlabel('帧数')
                        ax1.set_ylabel('角度 (度)')
                        ax1.set_title(f'{angle}角度 - 左肩关节角度变化')
                        ax1.legend()
                        ax1.grid(True, alpha=0.3)
                    elif angle == 'side' and shoulder_selection == 'right':
                        # 侧面角度且选择右肩：只显示右肩曲线
                        ax1.plot(frames, right_angles_filtered, 'r-', linewidth=2, label='右肩')
                        ax1.set_xlabel('帧数')
                        ax1.set_ylabel('角度 (度)')
                        ax1.set_title(f'{angle}角度 - 右肩关节角度变化')
                        ax1.legend()
                        ax1.grid(True, alpha=0.3)
                    else:
                        # 正面角度或其他情况：显示两条曲线
                        ax1.plot(frames, left_angles_filtered, 'b-', linewidth=2, label='左肩')
                        ax1.plot(frames, right_angles_filtered, 'r-', linewidth=2, label='右肩')
                        ax1.set_xlabel('帧数')
                        ax1.set_ylabel('角度 (度)')
                        ax1.set_title(f'{angle}角度 - 肩关节角度变化')
                        ax1.legend()
                        ax1.grid(True, alpha=0.3)
                    
                    # 生成角度-速度分布图
                    if result.get('velocity_data'):
                        left_velocities = [d['left_velocity'] for d in result['velocity_data']]
                        right_velocities = [d['right_velocity'] for d in result['velocity_data']]
                        
                        if angle == 'side' and shoulder_selection == 'left':
                            # 侧面角度且选择左肩：只显示左肩数据
                            ax2.scatter(left_angles_filtered[:len(left_velocities)], left_velocities, 
                                      c='blue', alpha=0.6, label='左肩')
                            ax2.set_xlabel('角度 (度)')
                            ax2.set_ylabel('角速度 (度/帧)')
                            ax2.set_title(f'{angle}角度 - 左肩角度-速度分布')
                            ax2.legend()
                            ax2.grid(True, alpha=0.3)
                        elif angle == 'side' and shoulder_selection == 'right':
                            # 侧面角度且选择右肩：只显示右肩数据
                            ax2.scatter(right_angles_filtered[:len(right_velocities)], right_velocities, 
                                      c='red', alpha=0.6, label='右肩')
                            ax2.set_xlabel('角度 (度)')
                            ax2.set_ylabel('角速度 (度/帧)')
                            ax2.set_title(f'{angle}角度 - 右肩角度-速度分布')
                            ax2.legend()
                            ax2.grid(True, alpha=0.3)
                        else:
                            # 正面角度或其他情况：显示两条曲线
                            ax2.scatter(left_angles_filtered[:len(left_velocities)], left_velocities, 
                                      c='blue', alpha=0.6, label='左肩')
                            ax2.scatter(right_angles_filtered[:len(right_velocities)], right_velocities, 
                                      c='red', alpha=0.6, label='右肩')
                            ax2.set_xlabel('角度 (度)')
                            ax2.set_ylabel('角速度 (度/帧)')
                            ax2.set_title(f'{angle}角度 - 角度-速度分布')
                            ax2.legend()
                            ax2.grid(True, alpha=0.3)
                    
                    plt.tight_layout()
                    # 使用中文文件名
                    angle_name = '正面' if angle == 'front' else '侧面'
                    charts[f'{angle_name}_角度分析'] = fig
        
        # 处理后视数据（手腕高度）
        if 'back' in analysis_results and analysis_results['back']:
            result = analysis_results['back']
            
            if result.get('wrist_height_data'):
                frames = [d['frame'] for d in result['wrist_height_data']]
                left_heights = [d['left_wrist_height'] for d in result['wrist_height_data']]
                right_heights = [d['right_wrist_height'] for d in result['wrist_height_data']]
                
                # 应用滤波
                left_heights_filtered = self.apply_moving_average(left_heights)
                right_heights_filtered = self.apply_moving_average(right_heights)
                
                fig, ax = plt.subplots(figsize=(16, 8))
                ax.plot(frames, left_heights_filtered, 'b-', linewidth=2, label='左腕')
                ax.plot(frames, right_heights_filtered, 'r-', linewidth=2, label='右腕')
                ax.set_xlabel('帧数')
                ax.set_ylabel('高度比例')
                ax.set_title('后视角度 - 左右腕高度变化')
                ax.legend()
                ax.grid(True, alpha=0.3)
                
                plt.tight_layout()
                charts['背面_手腕高度'] = fig
        
        return charts
    
    def process_analysis_data(self, analysis_results: Dict[str, Any], 
                            patient_name: str, patient_id: int, 
                            patient_info: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        处理分析数据，生成报告所需的数据结构
        
        Args:
            analysis_results: 分析结果
            patient_name: 患者姓名
            patient_id: 患者ID
            patient_info: 患者详细信息（年龄、性别、身高、体重等）
            
        Returns:
            Dict[str, Any]: 处理后的数据
        """
        # 准备患者基本信息
        base_patient_info = {
            'id': patient_id,
            'name': patient_name,
            'analysis_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # 如果提供了完整的患者信息，则合并到基本信息中
        if patient_info:
            base_patient_info.update({
                'age': patient_info.get('age', 0),
                'gender': patient_info.get('gender', ''),
                'height': patient_info.get('height', 0),
                'weight': patient_info.get('weight', 0),
                'symptoms': patient_info.get('symptoms', ''),
                'duration': patient_info.get('duration', 0),
                'treatment': patient_info.get('treatment', ''),
                'project': patient_info.get('project', ''),
                'fill_person': patient_info.get('fill_person', ''),
                'address': patient_info.get('address', '')
            })
        
        processed_data = {
            'patient_info': base_patient_info,
            'left_shoulder_data': {},
            'right_shoulder_data': {},
            'wrist_data': {},
            'summary': {}
        }
        
        # 处理侧视数据（主要分析数据）
        if 'side' in analysis_results and analysis_results['side']:
            result = analysis_results['side']
            
            if result.get('angle_data'):
                left_angles = [d['left_angle'] for d in result['angle_data']]
                right_angles = [d['right_angle'] for d in result['angle_data']]
                
                # 左肩数据
                processed_data['left_shoulder_data'] = {
                    'max_angle': round(max(left_angles), 2),
                    'min_angle': round(min(left_angles), 2),
                    'avg_angle': round(np.mean(left_angles), 2),
                    'angle_range': round(max(left_angles) - min(left_angles), 2)
                }
                
                # 右肩数据
                processed_data['right_shoulder_data'] = {
                    'max_angle': round(max(right_angles), 2),
                    'min_angle': round(min(right_angles), 2),
                    'avg_angle': round(np.mean(right_angles), 2),
                    'angle_range': round(max(right_angles) - min(right_angles), 2)
                }
                
                # 计算速度数据
                if result.get('velocity_data'):
                    left_velocities = [d['left_velocity'] for d in result['velocity_data']]
                    right_velocities = [d['right_velocity'] for d in result['velocity_data']]
                    
                    # 分阶段速度数据（0-45°, 45-90°, 90-135°, 135-180°）
                    left_velocity_stages = self.calculate_stage_velocities(left_angles, left_velocities)
                    right_velocity_stages = self.calculate_stage_velocities(right_angles, right_velocities)
                    
                    processed_data['left_shoulder_data']['velocity_stages'] = left_velocity_stages
                    processed_data['right_shoulder_data']['velocity_stages'] = right_velocity_stages
                    processed_data['left_shoulder_data']['max_velocity'] = round(max(abs(v) for v in left_velocities), 2)
                    processed_data['right_shoulder_data']['max_velocity'] = round(max(abs(v) for v in right_velocities), 2)
        
        # 处理后视数据
        if 'back' in analysis_results and analysis_results['back']:
            result = analysis_results['back']
            
            if result.get('wrist_height_data'):
                left_heights = [d['left_wrist_height'] for d in result['wrist_height_data']]
                right_heights = [d['right_wrist_height'] for d in result['wrist_height_data']]
                
                processed_data['wrist_data'] = {
                    'left_max_height': round(max(left_heights), 2),
                    'right_max_height': round(max(right_heights), 2),
                    'left_avg_height': round(np.mean(left_heights), 2),
                    'right_avg_height': round(np.mean(right_heights), 2)
                }
        
        # 生成综合评估
        processed_data['summary'] = self.generate_summary(processed_data)
        
        return processed_data
    
    def calculate_stage_velocities(self, angles: List[float], velocities: List[float]) -> List[float]:
        """
        计算分阶段速度数据
        
        Args:
            angles: 角度列表
            velocities: 速度列表
            
        Returns:
            List[float]: 分阶段速度数据
        """
        stages = [(0, 45), (45, 90), (90, 135), (135, 180)]
        stage_velocities = []
        
        for stage_min, stage_max in stages:
            stage_velocities_in_range = []
            for i, angle in enumerate(angles):
                if stage_min <= angle <= stage_max and i < len(velocities):
                    stage_velocities_in_range.append(abs(velocities[i]))
            
            if stage_velocities_in_range:
                stage_velocities.append(round(np.mean(stage_velocities_in_range), 2))
            else:
                stage_velocities.append(0.0)
        
        return stage_velocities
    
    def generate_summary(self, processed_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        生成综合评估摘要
        
        Args:
            processed_data: 处理后的数据
            
        Returns:
            Dict[str, Any]: 评估摘要
        """
        summary = {
            'function_score': 0,
            'function_assessment': '',
            'recommendations': []
        }
        
        # 计算功能评分（基于最大角度、速度等指标）
        score = 0
        total_indicators = 0
        
        if processed_data.get('left_shoulder_data'):
            left_data = processed_data['left_shoulder_data']
            if 'max_angle' in left_data:
                # 角度评分（满分30分）
                angle_score = min(30, left_data['max_angle'] / 180 * 30)
                score += angle_score
                total_indicators += 30
            
            if 'max_velocity' in left_data:
                # 速度评分（满分35分）
                velocity_score = min(35, left_data['max_velocity'] / 10 * 35)
                score += velocity_score
                total_indicators += 35
        
        if processed_data.get('right_shoulder_data'):
            right_data = processed_data['right_shoulder_data']
            if 'max_angle' in right_data:
                angle_score = min(30, right_data['max_angle'] / 180 * 30)
                score += angle_score
                total_indicators += 30
            
            if 'max_velocity' in right_data:
                velocity_score = min(35, right_data['max_velocity'] / 10 * 35)
                score += velocity_score
                total_indicators += 35
        
        # 计算最终评分
        if total_indicators > 0:
            summary['function_score'] = round(score / total_indicators * 100, 1)
        
        # 生成评估结果
        if summary['function_score'] >= 85:
            summary['function_assessment'] = "肩关节运动功能正常，活动度良好，无明显异常。"
            summary['recommendations'] = [
                "继续保持当前运动习惯",
                "定期进行肩关节保健运动",
                "注意运动时的正确姿势"
            ]
        elif summary['function_score'] >= 70:
            summary['function_assessment'] = "肩关节运动功能基本正常，存在轻微活动受限，建议进一步观察。"
            summary['recommendations'] = [
                "进行肩关节柔韧性训练",
                "避免过度使用肩关节",
                "定期进行功能评估"
            ]
        else:
            summary['function_assessment'] = "肩关节运动功能异常，存在明显活动受限，建议及时就医。"
            summary['recommendations'] = [
                "立即停止剧烈运动",
                "咨询专业医生进行详细检查",
                "制定个性化康复计划"
            ]
        
        return summary 