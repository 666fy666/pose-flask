"""
字体配置文件
用于设置matplotlib的中文字体支持
"""

import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import os
import platform

def setup_chinese_font():
    """
    设置中文字体支持
    自动检测系统可用的中文字体并配置matplotlib
    """
    # 检测操作系统
    system = platform.system()
    
    # 定义中文字体优先级列表
    chinese_fonts = []
    
    if system == "Linux":
        # Linux系统字体
        chinese_fonts = [
            'Noto Sans CJK SC',      # Google Noto字体
            'Noto Sans CJK TC',      # 繁体中文
            'AR PL UMing CN',        # AR PL字体
            'AR PL UKai CN',         # AR PL楷体
            'WenQuanYi Micro Hei',   # 文泉驿微米黑
            'WenQuanYi Zen Hei',     # 文泉驿正黑
            'Droid Sans Fallback',   # Android字体
            'SimHei',                # 黑体
            'Microsoft YaHei',       # 微软雅黑
            'PingFang SC',           # 苹方
            'Hiragino Sans GB',      # 冬青黑体
            'Source Han Sans CN',    # 思源黑体
            'Source Han Serif CN',   # 思源宋体
        ]
    elif system == "Windows":
        # Windows系统字体
        chinese_fonts = [
            'Microsoft YaHei',       # 微软雅黑
            'SimHei',                # 黑体
            'SimSun',                # 宋体
            'KaiTi',                 # 楷体
            'FangSong',              # 仿宋
            'Noto Sans CJK SC',      # Noto字体
        ]
    elif system == "Darwin":  # macOS
        # macOS系统字体
        chinese_fonts = [
            'PingFang SC',           # 苹方
            'Hiragino Sans GB',      # 冬青黑体
            'STHeiti',               # 华文黑体
            'STSong',                # 华文宋体
            'Arial Unicode MS',      # Arial Unicode
            'Noto Sans CJK SC',      # Noto字体
        ]
    
    # 查找可用的中文字体
    available_font = None
    for font_name in chinese_fonts:
        try:
            # 检查字体是否可用
            font_path = fm.findfont(fm.FontProperties(family=font_name))
            if font_path != fm.rcParams['font.sans-serif'][0]:
                available_font = font_name
                break
        except:
            continue
    
    # 如果没找到指定字体，尝试自动检测
    if not available_font:
        # 获取所有字体
        font_list = [f.name for f in fm.fontManager.ttflist]
        
        # 查找包含中文字符的字体
        for font in font_list:
            if any(keyword in font.lower() for keyword in ['chinese', 'cjk', 'sc', 'tc', 'cn', 'zh']):
                available_font = font
                break
    
    # 设置matplotlib字体
    if available_font:
        plt.rcParams['font.sans-serif'] = [available_font] + plt.rcParams['font.sans-serif']
        print(f"已设置中文字体: {available_font}")
    else:
        # 如果都没找到，使用默认设置
        plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Arial Unicode MS'] + plt.rcParams['font.sans-serif']
        print("警告: 未找到合适的中文字体，使用默认字体")
    
    # 设置负号显示
    plt.rcParams['axes.unicode_minus'] = False
    
    # 验证字体设置
    try:
        fig, ax = plt.subplots(figsize=(1, 1))
        ax.text(0.5, 0.5, '测试中文', fontsize=12)
        plt.close(fig)
        print("中文字体设置成功")
        return True
    except Exception as e:
        print(f"字体设置验证失败: {e}")
        return False

def get_font_properties(font_size=12, font_weight='normal'):
    """
    获取字体属性对象
    
    Args:
        font_size: 字体大小
        font_weight: 字体粗细
        
    Returns:
        FontProperties: 字体属性对象
    """
    # 确保字体已设置
    setup_chinese_font()
    
    # 获取当前设置的中文字体
    chinese_font = plt.rcParams['font.sans-serif'][0]
    
    return fm.FontProperties(
        family=chinese_font,
        size=font_size,
        weight=font_weight
    )

def test_chinese_display():
    """
    测试中文显示功能
    """
    setup_chinese_font()
    
    # 创建测试图表
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
    
    # 测试图表1：角度变化
    x = range(10)
    y1 = [i * 10 for i in x]
    y2 = [i * 8 for i in x]
    
    ax1.plot(x, y1, 'b-', linewidth=2, label='左肩')
    ax1.plot(x, y2, 'r-', linewidth=2, label='右肩')
    ax1.set_xlabel('帧数')
    ax1.set_ylabel('角度 (度)')
    ax1.set_title('肩关节角度变化')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # 测试图表2：手腕高度
    ax2.plot(x, y1, 'g-', linewidth=2, label='左腕')
    ax2.plot(x, y2, 'm-', linewidth=2, label='右腕')
    ax2.set_xlabel('帧数')
    ax2.set_ylabel('高度比例')
    ax2.set_title('手腕高度变化')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # 保存测试图片
    test_path = 'chinese_font_test.png'
    plt.savefig(test_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"中文显示测试完成，图片保存为: {test_path}")
    return test_path

if __name__ == "__main__":
    # 运行测试
    test_chinese_display()