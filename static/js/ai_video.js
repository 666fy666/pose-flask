// AI视频分析页面JavaScript
document.addEventListener('DOMContentLoaded', function() {
    let uploadedVideos = {
        front: null,
        side: null,
        back: null
    };
    
    let analysisInProgress = false;
    let currentAnalysisId = null;
    
    // 患者选择相关变量
    let selectedPatient = null;
    let patientsList = [];
    
    // 时间轴相关变量
    let timelineData = {
        front: { start: 0, end: 0, duration: 0, isDragging: false, dragHandle: null },
        side: { start: 0, end: 0, duration: 0, isDragging: false, dragHandle: null },
        back: { start: 0, end: 0, duration: 0, isDragging: false, dragHandle: null }
    };

    // 初始化页面
    initializePage();
    
    // 页面加载时恢复患者选择状态
    restorePatientSelection();
    
    // 绑定事件监听器
    bindEventListeners();

    function initializePage() {
        // 初始化置信度滑块
        const confidenceSlider = document.getElementById('confidenceThreshold');
        const confidenceValue = document.getElementById('confidenceValue');
        
        if (confidenceSlider && confidenceValue) {
            confidenceSlider.addEventListener('input', function() {
                confidenceValue.textContent = this.value + '%';
            });
        }
        
        // 初始化进度条按钮
        initializeProgressButton();
        
        // 默认收起上传卡片
        collapseVideoUploadSection();
        
        // 初始化上传状态文本
        updateUploadStatusText();
        
        // 初始化患者选择界面
        updatePatientSelectionUI();
        
        // 初始化分析状态文本
        updateAnalysisStatusText();
        
        // 检查患者记录并初始化患者选择
        checkPatientsAndInitialize();
    }

    function initializeProgressButton() {
        const progressButton = document.getElementById('startAnalysisBtn');
        if (progressButton) {
            const progressRing = progressButton.querySelector('.progress-ring-progress');
            const radius = 27;
            const circumference = 2 * Math.PI * radius;
            
            // 设置初始状态
            progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
            progressRing.style.strokeDashoffset = circumference;
        }
    }

    function bindEventListeners() {
        // 绑定文件上传事件
        bindFileUploadEvents();
        
        // 绑定批量上传按钮
        const batchUploadBtn = document.getElementById('batchUploadBtn');
        if (batchUploadBtn) {
            batchUploadBtn.addEventListener('click', handleBatchUpload);
        }
        
        // 绑定开始分析按钮
        const startMultiAnalysisBtn = document.getElementById('startMultiAnalysisBtn');
        if (startMultiAnalysisBtn) {
            startMultiAnalysisBtn.addEventListener('click', startMultiAnalysis);
        }
        
        // 绑定刷新预览按钮
        const refreshVideoPreviewsBtn = document.getElementById('refreshVideoPreviewsBtn');
        if (refreshVideoPreviewsBtn) {
            refreshVideoPreviewsBtn.addEventListener('click', function() {
                refreshVideoPreviews();
                // 手动初始化所有时间轴
                const angles = ['front', 'side', 'back'];
                angles.forEach(angle => {
                    const video = document.getElementById(`${angle}VideoPreview`);
                    if (video && video.src) {
                        console.log(`手动初始化${angle}角度时间轴`);
                        initializeTimeline(angle);
                    }
                });
                showAlert('视频预览已刷新，时间轴已重新初始化', 'success');
            });
        }
        
        // 绑定分析控制按钮
        const startAnalysisBtn = document.getElementById('startAnalysisBtn');
        const stopAnalysisBtn = document.getElementById('stopAnalysisBtn');
        const exportResultBtn = document.getElementById('exportResultBtn');
        
        if (startAnalysisBtn) {
            startAnalysisBtn.addEventListener('click', startAnalysis);
        }
        if (stopAnalysisBtn) {
            stopAnalysisBtn.addEventListener('click', stopAnalysis);
        }
        if (exportResultBtn) {
            exportResultBtn.addEventListener('click', exportResults);
        }
        
        // 绑定患者选择相关按钮
        const selectPatientBtn = document.getElementById('selectPatientBtn');
        const createPatientBtn = document.getElementById('createPatientBtn');
        const changePatientBtn = document.getElementById('changePatientBtn');
        const clearPatientBtn = document.getElementById('clearPatientBtn');
        const refreshPatientsBtn = document.getElementById('refreshPatientsBtn');
        const createPatientFromModalBtn = document.getElementById('createPatientFromModalBtn');
        const goToCreatePatientBtn = document.getElementById('goToCreatePatientBtn');
        
        if (selectPatientBtn) {
            selectPatientBtn.addEventListener('click', showPatientSelectModal);
        }
        if (createPatientBtn) {
            createPatientBtn.addEventListener('click', goToCreatePatient);
        }
        if (changePatientBtn) {
            changePatientBtn.addEventListener('click', function() {
                // 清除当前患者选择
                clearPatientSelection();
                selectedPatient = null;
                
                // 清除视频状态
                uploadedVideos = {
                    front: null,
                    side: null,
                    back: null
                };
                
                // 重置分析状态
                analysisInProgress = false;
                currentAnalysisId = null;
                
                // 重置时间轴数据
                timelineData = {
                    front: { start: 0, end: 0, duration: 0, isDragging: false, dragHandle: null },
                    side: { start: 0, end: 0, duration: 0, isDragging: false, dragHandle: null },
                    back: { start: 0, end: 0, duration: 0, isDragging: false, dragHandle: null }
                };
                
                // 重置界面状态
                updatePatientSelectionUI();
                updateUploadStatusText();
                updateAnalysisStatusText();
                
                // 重置分析按钮状态
                updateAnalysisButtons(false);
                
                // 隐藏视频预览区域
                const previewSection = document.getElementById('videoPreviewSection');
                if (previewSection) {
                    previewSection.style.display = 'none';
                }
                
                // 隐藏分析结果区域
                const resultSection = document.getElementById('analysisResultSection');
                if (resultSection) {
                    resultSection.style.display = 'none';
                }
                
                // 隐藏分析控制区域
                const controlSection = document.getElementById('analysisControlSection');
                if (controlSection) {
                    controlSection.style.display = 'none';
                }
                
                // 展开上传卡片
                expandVideoUploadSection();
                
                // 清除所有视频预览
                const angles = ['front', 'side', 'back'];
                angles.forEach(angle => {
                    // 重置上传状态
                    updateUploadStatus(angle, 'default');
                    
                    // 清除视频预览
                    const videoElement = document.getElementById(angle + 'VideoPreview');
                    if (videoElement) {
                        videoElement.src = '';
                        videoElement.load();
                    }
                    
                    // 重置文件输入
                    const fileInput = document.getElementById(angle + 'VideoFile');
                    if (fileInput) {
                        fileInput.value = '';
                    }
                    
                    // 隐藏上传进度和操作按钮
                    const progressElement = document.getElementById(angle + 'Progress');
                    const actionsElement = document.getElementById(angle + 'Actions');
                    if (progressElement) progressElement.style.display = 'none';
                    if (actionsElement) actionsElement.style.display = 'none';
                });
                
                // 清除分析历史记录显示
                const historyTableBody = document.getElementById('historyTableBody');
                if (historyTableBody) {
                    historyTableBody.innerHTML = `
                        <tr>
                            <td colspan="4" class="text-center text-muted">
                                <i class="fas fa-info-circle me-2"></i>
                                请先选择患者以查看分析历史记录
                            </td>
                        </tr>
                    `;
                }
                
                // 显示患者选择模态框
                showPatientSelectModal();
                
                showAlert('已清除当前患者选择，请选择新患者', 'info');
            });
        }
        if (clearPatientBtn) {
            clearPatientBtn.addEventListener('click', function() {
                if (confirm('确定要清除患者选择吗？这将清除所有相关的视频和分析状态。')) {
                    // 清除患者选择
                    clearPatientSelection();
                    selectedPatient = null;
                    
                    // 清除视频状态
                    uploadedVideos = {
                        front: null,
                        side: null,
                        back: null
                    };
                    
                    // 重置界面状态
                    updatePatientSelectionUI();
                    updateUploadStatusText();
                    updateAnalysisStatusText();
                    
                    // 隐藏视频预览区域
                    const previewSection = document.getElementById('videoPreviewSection');
                    if (previewSection) {
                        previewSection.style.display = 'none';
                    }
                    
                    // 展开上传卡片
                    expandVideoUploadSection();
                    
                    showAlert('患者选择已清除', 'success');
                }
            });
        }
        if (refreshPatientsBtn) {
            refreshPatientsBtn.addEventListener('click', loadPatientsList);
        }
        if (createPatientFromModalBtn) {
            createPatientFromModalBtn.addEventListener('click', goToCreatePatient);
        }
        if (goToCreatePatientBtn) {
            goToCreatePatientBtn.addEventListener('click', goToCreatePatient);
        }
        
        // 绑定患者搜索功能
        const patientSearchInput = document.getElementById('patientSearchInput');
        if (patientSearchInput) {
            patientSearchInput.addEventListener('input', filterPatients);
        }
        
        // 绑定历史记录刷新按钮
        const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
        if (refreshHistoryBtn) {
            refreshHistoryBtn.addEventListener('click', loadAnalysisHistory);
        }
        

        
        // 绑定下拉式卡片点击事件
        const videoUploadHeader = document.getElementById('videoUploadHeader');
        if (videoUploadHeader) {
            videoUploadHeader.addEventListener('click', toggleVideoUploadSection);
        }
        
        // 页面卸载时保存状态
        window.addEventListener('beforeunload', function() {
            if (selectedPatient) {
                savePatientSelection(selectedPatient);
            }
        });
    }

    function bindFileUploadEvents() {
        const fileInputs = ['frontVideoFile', 'sideVideoFile', 'backVideoFile'];
        
        fileInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('change', function(e) {
                    handleFileUpload(e, this.dataset.angle);
                });
            }
        });
    }

    function handleFileUpload(event, angle) {
        if (!selectedPatient) {
            showAlert('请先选择患者', 'error');
            return;
        }

        const file = event.target.files[0];
        if (!file) return;

        // 验证文件类型
        if (!isValidVideoFile(file)) {
            showAlert('请选择有效的视频文件（MP4, AVI, MOV）', 'error');
            return;
        }

        // 验证文件大小
        if (file.size > 100 * 1024 * 1024) { // 100MB
            showAlert('文件大小不能超过100MB', 'error');
            return;
        }

        // 检查是否已有该角度的视频
        if (uploadedVideos[angle] !== null) {
            // 显示确认对话框
            if (confirm(`该患者已有${angle}角度的视频，重新上传将覆盖原文件。是否继续？`)) {
                uploadVideo(file, angle);
            } else {
                // 重置文件输入
                event.target.value = '';
            }
        } else {
            // 直接上传
            uploadVideo(file, angle);
        }
    }

    function isValidVideoFile(file) {
        const validTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo'];
        return validTypes.includes(file.type) || file.name.match(/\.(mp4|avi|mov)$/i);
    }

    function uploadVideo(file, angle) {
        if (!selectedPatient) {
            showAlert('请先选择患者', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('video', file);
        formData.append('angle', angle);
        formData.append('patientId', selectedPatient.id);

        // 检查是否已有该角度的视频
        const hasExistingVideo = uploadedVideos[angle] !== null;
        
        // 更新UI状态
        updateUploadStatus(angle, 'uploading');
        showUploadProgress(angle, true);

        fetch('/api/upload_video', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                uploadedVideos[angle] = {
                    file: file,
                    url: data.url,
                    filename: data.filename
                };
                updateUploadStatus(angle, 'uploaded');
                showUploadProgress(angle, false);
                
                // 立即更新视频预览
                updateVideoPreview(angle, data.url);
                
                // 显示相应的成功消息
                if (data.replaced) {
                    showAlert(`${angle}角度视频已重新上传并覆盖原文件`, 'success');
                } else {
                    showAlert(`${angle}角度视频上传成功`, 'success');
                }
                
                // 检查所有视频状态并更新界面
                checkAllVideosUploaded();
                
                // 强制刷新视频预览区域
                setTimeout(() => {
                    refreshVideoPreviews();
                }, 100);
            } else {
                updateUploadStatus(angle, 'error');
                showUploadProgress(angle, false);
                showAlert('上传失败：' + data.message, 'error');
            }
        })
        .catch(error => {
            updateUploadStatus(angle, 'error');
            showUploadProgress(angle, false);
            showAlert('上传失败：' + error.message, 'error');
        });
    }

    function updateUploadStatus(angle, status) {
        const statusElement = document.getElementById(angle + 'Status');
        if (statusElement) {
            statusElement.textContent = getStatusText(status);
            statusElement.className = 'upload-status ' + status;
        }

        const uploadCard = document.getElementById(angle + 'UploadCard');
        if (uploadCard) {
            uploadCard.className = 'upload-card ' + (status === 'uploaded' ? 'uploaded' : '');
        }
        
        // 显示/隐藏重新上传按钮
        const actionsElement = document.getElementById(angle + 'Actions');
        if (actionsElement) {
            actionsElement.style.display = status === 'uploaded' ? 'block' : 'none';
        }
        
        // 更新上传状态文本
        updateUploadStatusText();
    }

    function getStatusText(status) {
        const statusMap = {
            'uploading': '上传中...',
            'uploaded': '已上传',
            'error': '上传失败',
            'default': '未上传'
        };
        return statusMap[status] || statusMap.default;
    }

    function showUploadProgress(angle, show) {
        const progressElement = document.getElementById(angle + 'Progress');
        if (progressElement) {
            progressElement.style.display = show ? 'block' : 'none';
        }
    }

    function updateVideoPreview(angle, url) {
        const videoElement = document.getElementById(angle + 'VideoPreview');
        if (videoElement) {
            if (url) {
                videoElement.src = url;
                videoElement.load();
                // 确保视频预览区域可见
                showVideoPreviewSection();
                
                // 监听视频加载事件
                const handleVideoLoad = () => {
                    console.log(`${angle}角度视频加载完成，初始化时间轴`);
                    initializeTimeline(angle);
                    videoElement.removeEventListener('loadedmetadata', handleVideoLoad);
                    videoElement.removeEventListener('canplay', handleVideoLoad);
                };
                
                // 添加多个事件监听器确保捕获到加载完成
                videoElement.addEventListener('loadedmetadata', handleVideoLoad);
                videoElement.addEventListener('canplay', handleVideoLoad);
                
                // 备用方案：延迟初始化
                setTimeout(() => {
                    if (videoElement.readyState >= 1) {
                        console.log(`${angle}角度视频已加载，延迟初始化时间轴`);
                        initializeTimeline(angle);
                    }
                }, 1000);
            } else {
                // 清除视频预览
                videoElement.src = '';
                videoElement.load();
            }
        }
    }

    function checkAllVideosUploaded() {
        const allUploaded = Object.values(uploadedVideos).every(video => video !== null);
        const hasAnyVideo = Object.values(uploadedVideos).some(video => video !== null);
        const startMultiAnalysisBtn = document.getElementById('startMultiAnalysisBtn');
        
        console.log('checkAllVideosUploaded 被调用');
        console.log('uploadedVideos 状态:', uploadedVideos);
        console.log('allUploaded:', allUploaded, 'hasAnyVideo:', hasAnyVideo);
        
        if (startMultiAnalysisBtn) {
            // 只要有视频就可以开始分析，不需要所有视频都存在
            startMultiAnalysisBtn.disabled = !hasAnyVideo;
            console.log('开始分析按钮状态:', !hasAnyVideo ? '禁用' : '启用');
        }

        // 更新上传状态文本
        updateUploadStatusText();
        
        // 更新分析状态文本
        updateAnalysisStatusText();

        // 更新视频预览区域的显示状态
        const previewSection = document.getElementById('videoPreviewSection');
        if (previewSection) {
            if (hasAnyVideo) {
                showVideoPreviewSection();
            } else {
                previewSection.style.display = 'none';
            }
        }

        if (allUploaded) {
            // 延迟一下再收起上传卡片，让用户看到完成状态
            setTimeout(() => {
                collapseVideoUploadSection();
                showAlert('所有视频上传完成，已自动收起上传区域', 'success');
            }, 1500);
        }
    }

    function showVideoPreviewSection() {
        const previewSection = document.getElementById('videoPreviewSection');
        if (previewSection) {
            previewSection.style.display = 'block';
            previewSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function handleBatchUpload() {
        // 创建隐藏的文件输入元素
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'video/*';
        
        input.addEventListener('change', function(e) {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            // 根据文件名自动分配角度
            files.forEach(file => {
                const angle = detectAngleFromFilename(file.name);
                if (angle && !uploadedVideos[angle]) {
                    uploadVideo(file, angle);
                }
            });
        });

        input.click();
    }

    function detectAngleFromFilename(filename) {
        const lowerName = filename.toLowerCase();
        if (lowerName.includes('front') || lowerName.includes('正面')) return 'front';
        if (lowerName.includes('side') || lowerName.includes('侧面')) return 'side';
        if (lowerName.includes('back') || lowerName.includes('背面')) return 'back';
        return null;
    }

    function startMultiAnalysis() {
        if (!selectedPatient) {
            showAlert('请先选择患者', 'error');
            return;
        }
        
        // 检查是否有上传的视频
        const hasVideos = Object.values(uploadedVideos).some(video => video !== null);
        if (!hasVideos) {
            showAlert('请先上传至少一个视频', 'error');
            return;
        }
        
        // 显示分析控制区域
        showAnalysisControlSection();
        
        // 显示提示信息
        const uploadedCount = Object.values(uploadedVideos).filter(video => video !== null).length;
        if (uploadedCount < 3) {
            showAlert(`当前有 ${uploadedCount}/3 个视频，可以进行部分分析`, 'info');
        } else {
            showAlert('所有视频已准备就绪，可以开始综合分析', 'success');
        }
    }

    function startAnalysis() {
        if (!selectedPatient) {
            showAlert('请先选择患者', 'warning');
            return;
        }
        
        // 检查是否有视频文件
        const hasVideos = Object.values(uploadedVideos).some(video => video !== null);
        if (!hasVideos) {
            showAlert('请先上传视频文件', 'warning');
            return;
        }
        
        // 获取分析参数
        const analysisType = document.getElementById('analysisType').value;
        const confidenceThreshold = document.getElementById('confidenceThreshold').value;
        const shoulderSelection = document.getElementById('shoulderSelection').value; // 新增：获取肩部选择
        
        // 获取时间轴数据
        const timelineData = getTimelineDataForAnalysis();
        
        // 准备分析数据
        const analysisData = {
            patientId: selectedPatient.id,
            videos: uploadedVideos,
            analysisType: analysisType,
            confidenceThreshold: parseInt(confidenceThreshold),
            shoulderSelection: shoulderSelection, // 新增：传递肩部选择参数
            timelineData: timelineData
        };
        
        console.log('开始分析，参数:', analysisData);
        
        // 开始分析
        fetch('/api/analyze_video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(analysisData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentAnalysisId = data.analysisId;
                analysisInProgress = true;
                
                // 更新按钮状态
                updateAnalysisButtons(true);
                
                // 开始进度动画
                startProgressAnimation();
                
                // 开始轮询分析状态
                pollAnalysisStatus(data.analysisId);
                
                showAlert('分析已开始，请等待完成', 'success');
            } else {
                showAlert(data.message || '分析失败', 'error');
            }
        })
        .catch(error => {
            console.error('分析请求失败:', error);
            showAlert('分析请求失败，请重试', 'error');
        });
    }

    function pollAnalysisStatus(analysisId) {
        const pollInterval = setInterval(() => {
            fetch(`/api/analysis_status/${analysisId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const status = data.status;
                        
                        // 更新进度条
                        updateProgressFromStatus(status);
                        
                        if (status.status === 'completed') {
                            // 分析完成
                            clearInterval(pollInterval);
                            analysisInProgress = false;
                            updateAnalysisButtons(false);
                            
                            // 等待图表文件完全生成后再显示100%
                            if (status.result && status.result.chartFilesExist) {
                                completeProgressAnimation();
                                showAnalysisResultSection();
                                displayAnalysisResults(status.result);
                                showAlert('分析完成，图表已生成', 'success');
                            } else {
                                // 如果图表文件不存在，等待一段时间后重试
                                setTimeout(() => {
                                    verifyChartFilesExist(status.result.chartPaths || {}).then(filesExist => {
                                        completeProgressAnimation();
                                        showAnalysisResultSection();
                                        displayAnalysisResults(status.result);
                                        if (filesExist) {
                                            showAlert('分析完成，图表已生成', 'success');
                                        } else {
                                            showAlert('分析完成，但部分图表文件可能还在生成中', 'warning');
                                        }
                                    });
                                }, 2000);
                            }
                            
                            // 刷新历史记录
                            setTimeout(() => {
                                loadAnalysisHistory();
                            }, 1000);
                            
                        } else if (status.status === 'error') {
                            // 分析出错
                            clearInterval(pollInterval);
                            analysisInProgress = false;
                            updateAnalysisButtons(false);
                            completeProgressAnimation();
                            showAlert('分析失败：' + status.message, 'error');
                            
                        } else if (status.status === 'stopped') {
                            // 分析被停止
                            clearInterval(pollInterval);
                            analysisInProgress = false;
                            updateAnalysisButtons(false);
                            completeProgressAnimation();
                            showAlert('分析已被停止', 'info');
                        }
                        // 如果状态是running，继续轮询
                        
                    } else {
                        // 获取状态失败
                        clearInterval(pollInterval);
                        analysisInProgress = false;
                        updateAnalysisButtons(false);
                        completeProgressAnimation();
                        showAlert('获取分析状态失败：' + data.message, 'error');
                    }
                })
                .catch(error => {
                    clearInterval(pollInterval);
                    analysisInProgress = false;
                    updateAnalysisButtons(false);
                    completeProgressAnimation();
                    showAlert('获取分析状态失败：' + error.message, 'error');
                });
        }, 1000); // 每秒轮询一次
    }

    function updateProgressFromStatus(status) {
        const progressButton = document.getElementById('startAnalysisBtn');
        const progressRing = progressButton.querySelector('.progress-ring-progress');
        const progressText = progressButton.querySelector('.progress-text');
        const buttonText = progressButton.querySelector('.button-text');
        
        if (status.progress !== undefined) {
            // 计算圆的周长
            const radius = 27;
            const circumference = 2 * Math.PI * radius;
            
            // 更新进度
            const progressPercent = Math.round(status.progress);
            const offset = circumference - (progressPercent / 100) * circumference;
            
            progressRing.style.strokeDashoffset = offset;
            progressText.textContent = progressPercent + '%';
            
            // 更新按钮文本
            if (status.message) {
                buttonText.textContent = status.message;
            } else if (progressPercent < 30) {
                buttonText.textContent = '初始化中';
            } else if (progressPercent < 60) {
                buttonText.textContent = '分析中';
            } else if (progressPercent < 90) {
                buttonText.textContent = '处理中';
            } else {
                buttonText.textContent = '完成中';
            }
        }
    }

    function stopAnalysis() {
        if (!currentAnalysisId) {
            showAlert('没有正在进行的分析任务', 'warning');
            return;
        }
        
        if (!analysisInProgress) {
            showAlert('没有正在进行的分析任务', 'warning');
            return;
        }
        
        // 确认停止
        if (!confirm('确定要停止当前的分析任务吗？此操作不可撤销。')) {
            return;
        }
        
        // 调用停止API
        fetch(`/api/stop_analysis/${currentAnalysisId}`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('分析已停止', 'info');
                analysisInProgress = false;
                updateAnalysisButtons(false);
                // 重置进度条
                resetProgressAnimation();
                currentAnalysisId = null;
            } else {
                showAlert('停止分析失败：' + data.message, 'error');
            }
        })
        .catch(error => {
            showAlert('停止分析失败：' + error.message, 'error');
        });
    }

    function resetProgressAnimation() {
        const progressButton = document.getElementById('startAnalysisBtn');
        const progressRing = progressButton.querySelector('.progress-ring-progress');
        const progressText = progressButton.querySelector('.progress-text');
        const buttonText = progressButton.querySelector('.button-text');
        
        // 清除之前的interval
        if (progressButton.progressInterval) {
            clearInterval(progressButton.progressInterval);
            progressButton.progressInterval = null;
        }
        
        // 计算圆的周长
        const radius = 27;
        const circumference = 2 * Math.PI * radius;
        
        // 重置进度条
        progressRing.style.strokeDashoffset = circumference;
        progressText.textContent = '0%';
        buttonText.textContent = '开始分析';
    }

    function updateAnalysisButtons(analyzing) {
        const startBtn = document.getElementById('startAnalysisBtn');
        const stopBtn = document.getElementById('stopAnalysisBtn');
        const exportBtn = document.getElementById('exportResultBtn');

        if (startBtn) {
            if (analyzing) {
                startBtn.classList.add('analyzing');
                startBtn.disabled = true;
            } else {
                startBtn.classList.remove('analyzing');
                startBtn.disabled = false;
            }
        }
        
        // 停止分析按钮保持常驻显示，根据分析状态启用/禁用
        if (stopBtn) {
            stopBtn.style.display = 'inline-block';
            stopBtn.disabled = !analyzing;
        }
        
        if (exportBtn) exportBtn.style.display = analyzing ? 'none' : 'inline-block';
    }

    // 进度条管理函数
    function startProgressAnimation() {
        const progressButton = document.getElementById('startAnalysisBtn');
        const progressRing = progressButton.querySelector('.progress-ring-progress');
        const progressText = progressButton.querySelector('.progress-text');
        const buttonText = progressButton.querySelector('.button-text');
        
        // 计算圆的周长
        const radius = 27;
        const circumference = 2 * Math.PI * radius;
        
        // 设置初始状态
        progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
        progressRing.style.strokeDashoffset = circumference;
        progressText.textContent = '0%';
        buttonText.textContent = '开始分析';
        
        // 清除之前的interval
        if (progressButton.progressInterval) {
            clearInterval(progressButton.progressInterval);
            progressButton.progressInterval = null;
        }
    }

    function completeProgressAnimation() {
        const progressButton = document.getElementById('startAnalysisBtn');
        const progressRing = progressButton.querySelector('.progress-ring-progress');
        const progressText = progressButton.querySelector('.progress-text');
        const buttonText = progressButton.querySelector('.button-text');
        
        // 清除之前的interval
        if (progressButton.progressInterval) {
            clearInterval(progressButton.progressInterval);
            progressButton.progressInterval = null;
        }
        
        // 计算圆的周长
        const radius = 27;
        const circumference = 2 * Math.PI * radius;
        
        // 完成到100%
        const offset = 0;
        progressRing.style.strokeDashoffset = offset;
        progressText.textContent = '100%';
        buttonText.textContent = '完成';
        
        // 延迟后重置按钮
        setTimeout(() => {
            progressRing.style.strokeDashoffset = circumference;
            progressText.textContent = '0%';
            buttonText.textContent = '开始分析';
        }, 2000); // 延长显示时间到2秒
    }

    function showAnalysisResultSection() {
        const resultSection = document.getElementById('analysisResultSection');
        if (resultSection) {
            resultSection.style.display = 'block';
            resultSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function displayAnalysisResults(analysisResult) {
        // 修复：根据后端返回的数据结构显示结果
        const summary = analysisResult.summary || {};
        
        // 显示综合分析结果
        displayComprehensiveResult({
            overallScore: summary.function_score || 0,
            assessment: summary.function_assessment || '暂无评估结果',
            recommendations: summary.recommendations || []
        });
        
        // 显示图表和视频链接
        displayAnalysisFiles(analysisResult);
        
        // 强制刷新所有图表，避免缓存问题
        setTimeout(() => {
            refreshAllCharts();
        }, 1000);
    }

    function displayAngleResult(angle, result) {
        const resultElement = document.getElementById(angle + 'AnalysisResult');
        if (resultElement && result) {
            resultElement.innerHTML = `
                <div class="analysis-summary">
                    <div class="score-item">
                        <span class="score-label">置信度：</span>
                        <span class="score-value">${result.confidence}%</span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">关键点：</span>
                        <span class="score-value">${result.keypoints}个</span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">运动评分：</span>
                        <span class="score-value">${result.motionScore}/100</span>
                    </div>
                </div>
                <div class="analysis-details mt-3">
                    <h6>检测结果：</h6>
                    <p>${result.summary}</p>
                </div>
            `;
        }
    }

    function displayComprehensiveResult(result) {
        const resultElement = document.getElementById('comprehensiveAnalysisResult');
        if (resultElement && result) {
            resultElement.innerHTML = `
                <div class="comprehensive-summary">
                    <div class="overall-score">
                        <h3>综合评分：${result.overallScore}/100</h3>
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${result.overallScore}%"></div>
                        </div>
                    </div>
                    <div class="assessment-details">
                        <h5>评估结果：</h5>
                        <p>${result.assessment}</p>
                    </div>
                    <div class="recommendations">
                        <h5>建议：</h5>
                        <ul>
                            ${result.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }
    }

    function displayAnalysisFiles(analysisResult) {
        // 显示分析结果文件（图表、视频、报告）
        const filesSection = document.getElementById('analysisFilesSection');
        if (!filesSection) return;
        
        let filesHtml = '<div class="analysis-files mt-4">';
        
        // 显示图表文件 - 改为直接显示图片
        if (analysisResult.chartPaths && Object.keys(analysisResult.chartPaths).length > 0) {
            filesHtml += `
                <div class="file-group mb-4">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5><i class="fas fa-chart-line me-2"></i>分析图表</h5>
                        <button onclick="refreshAllCharts()" class="btn btn-outline-warning btn-sm" title="刷新所有图表">
                            <i class="fas fa-sync-alt me-1"></i>刷新所有图表
                        </button>
                    </div>
                    <div class="row">
            `;
            Object.entries(analysisResult.chartPaths).forEach(([name, path]) => {
                // 直接使用中文文件名，不需要转换
                const displayName = name;
                filesHtml += `
                    <div class="col-md-6 col-lg-4 mb-3">
                        <div class="chart-card">
                            <div class="chart-header">
                                <h6 class="chart-title">${displayName}</h6>
                                <div class="chart-actions">
                                    <button onclick="refreshChart('${path}', this)" class="btn btn-sm btn-outline-warning" title="刷新图表">
                                        <i class="fas fa-sync-alt"></i>
                                    </button>
                                    <a href="${path}" target="_blank" class="btn btn-sm btn-outline-primary" title="在新窗口打开">
                                        <i class="fas fa-external-link-alt"></i>
                                    </a>
                                    <button onclick="downloadImage('${path}', '${displayName}.png')" class="btn btn-sm btn-outline-secondary" title="下载图片">
                                        <i class="fas fa-download"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="chart-container">
                                <img src="${path}" alt="${displayName}" class="analysis-chart-img" 
                                     onload="this.parentElement.classList.add('loaded')" 
                                     onerror="this.parentElement.classList.add('error'); this.style.display='none'; this.nextElementSibling.style.display='block';">
                                <div class="chart-loading" style="display: none;">
                                    <i class="fas fa-exclamation-triangle text-warning"></i>
                                    <p class="text-muted mt-2">图片加载失败</p>
                                </div>
                                <div class="chart-loading-spinner">
                                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                                        <span class="visually-hidden">加载中...</span>
                                    </div>
                                    <p class="text-muted mt-2">加载中...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            filesHtml += '</div></div>';
        }
        
        // 显示标注视频
        if (analysisResult.videoOutputPaths && Object.keys(analysisResult.videoOutputPaths).length > 0) {
            filesHtml += '<div class="file-group mb-3"><h5><i class="fas fa-video me-2"></i>标注视频</h5><div class="row">';
            Object.entries(analysisResult.videoOutputPaths).forEach(([name, path]) => {
                // 从路径中提取文件名，格式为 患者姓名-角度.avi
                const filename = path.split('/').pop() || name;
                const displayName = filename.replace('.avi', '');
                filesHtml += `
                    <div class="col-md-6 col-lg-4 mb-2">
                        <button onclick="downloadVideo('${path}', '${filename}')" class="btn btn-outline-success btn-sm w-100">
                            <i class="fas fa-video me-2"></i>${displayName} (.avi)
                        </button>
                    </div>
                `;
            });
            filesHtml += '</div></div>';
        }
        
        // 显示报告文件
        if (analysisResult.reportPath) {
            // 从路径中提取文件名
            const reportFilename = analysisResult.reportPath.split('/').pop() || '分析报告.docx';
            filesHtml += `
                <div class="file-group mb-3">
                    <h5><i class="fas fa-file-word me-2"></i>分析报告</h5>
                    <button onclick="downloadReport('${analysisResult.reportPath}', '${reportFilename}')" class="btn btn-outline-info">
                        <i class="fas fa-file-word me-2"></i>下载Word格式报告
                    </button>
                </div>
            `;
        }
        
        filesHtml += '</div>';
        filesSection.innerHTML = filesHtml;
        filesSection.style.display = 'block';
        
        // 延迟检查图片加载状态
        setTimeout(() => {
            checkChartImagesLoaded();
        }, 2000);
    }
    
    function checkChartImagesLoaded() {
        const chartImages = document.querySelectorAll('.analysis-chart-img');
        chartImages.forEach(img => {
            if (!img.complete) {
                // 图片还在加载中，设置超时处理
                setTimeout(() => {
                    if (!img.complete) {
                        img.parentElement.classList.add('error');
                        img.style.display = 'none';
                        const errorDiv = img.nextElementSibling;
                        if (errorDiv && errorDiv.classList.contains('chart-loading')) {
                            errorDiv.style.display = 'block';
                        }
                    }
                }, 5000); // 5秒超时
            }
        });
    }
    
    function verifyChartFilesExist(chartPaths) {
        // 验证图表文件是否存在的函数
        return new Promise((resolve) => {
            if (!chartPaths || Object.keys(chartPaths).length === 0) {
                resolve(true);
                return;
            }
            
            const checkPromises = Object.entries(chartPaths).map(([name, path]) => {
                return new Promise((resolveCheck) => {
                    const img = new Image();
                    img.onload = () => resolveCheck(true);
                    img.onerror = () => resolveCheck(false);
                    img.src = path + '?t=' + new Date().getTime(); // 添加时间戳避免缓存
                });
            });
            
            Promise.all(checkPromises).then(results => {
                const allExist = results.every(exists => exists);
                resolve(allExist);
            });
        });
    }

    // 刷新图表函数
    window.refreshChart = function(chartPath, buttonElement) {
        const chartContainer = buttonElement.closest('.chart-card').querySelector('.chart-container');
        const img = chartContainer.querySelector('.analysis-chart-img');
        
        if (img) {
            // 添加时间戳避免缓存
            const timestamp = new Date().getTime();
            const newPath = chartPath + '?t=' + timestamp;
            
            // 重置加载状态
            chartContainer.classList.remove('loaded', 'error');
            img.style.display = 'block';
            
            // 显示加载动画
            const loadingSpinner = chartContainer.querySelector('.chart-loading-spinner');
            if (loadingSpinner) {
                loadingSpinner.style.display = 'flex';
            }
            
            // 隐藏错误信息
            const errorDiv = chartContainer.querySelector('.chart-loading');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
            
            // 重新加载图片
            img.onload = function() {
                chartContainer.classList.add('loaded');
                const loadingSpinner = chartContainer.querySelector('.chart-loading-spinner');
                if (loadingSpinner) {
                    loadingSpinner.style.display = 'none';
                }
            };
            
            img.onerror = function() {
                chartContainer.classList.add('error');
                img.style.display = 'none';
                const errorDiv = chartContainer.querySelector('.chart-loading');
                if (errorDiv) {
                    errorDiv.style.display = 'block';
                }
                const loadingSpinner = chartContainer.querySelector('.chart-loading-spinner');
                if (loadingSpinner) {
                    loadingSpinner.style.display = 'none';
                }
            };
            
            img.src = newPath;
            showAlert('图表正在刷新...', 'info');
        }
    };
    
    // 刷新所有图表函数
    window.refreshAllCharts = function() {
        const chartImages = document.querySelectorAll('.analysis-chart-img');
        chartImages.forEach(img => {
            if (img.src) {
                // 添加时间戳避免缓存
                const timestamp = new Date().getTime();
                const separator = img.src.includes('?') ? '&' : '?';
                img.src = img.src + separator + 't=' + timestamp;
            }
        });
        console.log('所有图表已刷新');
        showAlert('所有图表已刷新', 'success');
    }

    function exportResults() {
        if (!currentAnalysisId) {
            showAlert('没有可导出的分析结果', 'warning');
            return;
        }

        fetch(`/api/export_results/${currentAnalysisId}`, {
            method: 'GET'
        })
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analysis_results_${currentAnalysisId}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(error => {
            showAlert('导出失败：' + error.message, 'error');
        });
    }

    function showAlert(message, type) {
        // 创建提示框
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // 自动移除提示框
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }

    // 患者选择相关函数
    function checkPatientsAndInitialize() {
        // 检查是否存在患者记录
        fetch('/api/patients/check_exists')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (!data.exists) {
                        // 没有患者记录，显示提示模态框
                        showCreatePatientPrompt();
                    } else {
                        // 有患者记录，加载患者列表
                        loadPatientsList();
                    }
                } else {
                    showAlert('检查患者记录失败：' + data.message, 'error');
                }
            })
            .catch(error => {
                showAlert('检查患者记录失败：' + error.message, 'error');
            });
    }

    function showCreatePatientPrompt() {
        const modal = new bootstrap.Modal(document.getElementById('createPatientPromptModal'));
        modal.show();
    }

    function loadPatientsList() {
        return fetch('/api/patients/select')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    patientsList = data.data;
                    displayPatientsList(patientsList);
                    return patientsList;
                } else {
                    showAlert('加载患者列表失败：' + data.message, 'error');
                    throw new Error(data.message);
                }
            })
            .catch(error => {
                showAlert('加载患者列表失败：' + error.message, 'error');
                throw error;
            });
    }

    function displayPatientsList(patients) {
        const tbody = document.getElementById('patientSelectTableBody');
        const noPatientsMessage = document.getElementById('noPatientsMessage');
        
        if (!tbody) return;
        
        if (patients.length === 0) {
            tbody.innerHTML = '';
            if (noPatientsMessage) {
                noPatientsMessage.style.display = 'block';
            }
            return;
        }
        
        if (noPatientsMessage) {
            noPatientsMessage.style.display = 'none';
        }
        
        tbody.innerHTML = patients.map(patient => `
            <tr>
                <td>${patient.id}</td>
                <td>${patient.name}</td>
                <td>${patient.age || '-'}</td>
                <td>${patient.gender || '-'}</td>
                <td>${patient.record_time || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary select-patient-btn" data-patient-id="${patient.id}">
                        <i class="fas fa-check me-1"></i>选择
                    </button>
                </td>
            </tr>
        `).join('');
        
        // 为所有选择按钮添加事件监听器
        const selectButtons = tbody.querySelectorAll('.select-patient-btn');
        selectButtons.forEach(button => {
            button.addEventListener('click', function() {
                const patientId = parseInt(this.getAttribute('data-patient-id'));
                selectPatientInternal(patientId);
            });
        });
    }

    function filterPatients() {
        const searchTerm = document.getElementById('patientSearchInput').value.toLowerCase();
        const filteredPatients = patientsList.filter(patient => 
            patient.name.toLowerCase().includes(searchTerm) ||
            patient.id.toString().includes(searchTerm)
        );
        displayPatientsList(filteredPatients);
    }

    function showPatientSelectModal() {
        loadPatientsList();
        const modal = new bootstrap.Modal(document.getElementById('patientSelectModal'));
        modal.show();
    }

    function selectPatientInternal(patientId) {
        const patient = patientsList.find(p => p.id === patientId);
        if (!patient) {
            showAlert('患者信息不存在', 'error');
            return;
        }
        
        // 创建患者文件夹
        fetch(`/api/patients/${patientId}/create_folder`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                selectedPatient = patient;
                
                // 保存患者选择到localStorage
                savePatientSelection(patient);
                
                updateSelectedPatientDisplay();
                
                // 关闭模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('patientSelectModal'));
                if (modal) {
                    modal.hide();
                }
                
                showAlert('患者选择成功，文件夹已创建', 'success');
                
                // 检查患者是否已有视频文件
                checkPatientVideos(patientId).then(() => {
                    // 加载分析历史记录
                    loadAnalysisHistory();
                });
            } else {
                showAlert('创建患者文件夹失败：' + data.message, 'error');
            }
        })
        .catch(error => {
            showAlert('创建患者文件夹失败：' + error.message, 'error');
        });
    }

    function checkPatientVideos(patientId) {
        return checkPatientVideosAsync(patientId);
    }

    function checkPatientVideosAsync(patientId) {
        console.log('开始检查患者视频，患者ID:', patientId);
        return fetch(`/api/patients/${patientId}/videos/check`)
            .then(response => response.json())
            .then(data => {
                console.log('患者视频检查结果:', data);
                if (data.success) {
                    if (data.allExist) {
                        console.log('所有视频都存在');
                        // 所有视频都存在，直接显示预览
                        uploadedVideos = {
                            front: { url: data.urls.front, filename: 'front.mp4' },
                            side: { url: data.urls.side, filename: 'side.mp4' },
                            back: { url: data.urls.back, filename: 'back.mp4' }
                        };
                        
                        // 更新上传状态
                        updateUploadStatus('front', 'uploaded');
                        updateUploadStatus('side', 'uploaded');
                        updateUploadStatus('back', 'uploaded');
                        
                        // 更新状态文本
                        updateUploadStatusText();
                        
                        // 显示视频预览
                        showVideoPreviewSection();
                        
                        // 立即更新视频预览
                        Object.keys(data.urls).forEach(angle => {
                            updateVideoPreview(angle, data.urls[angle]);
                        });
                        
                        // 收起上传卡片
                        collapseVideoUploadSection();
                        
                        // 检查所有视频状态并更新界面
                        checkAllVideosUploaded();
                        
                        // 强制刷新视频预览
                        setTimeout(() => {
                            refreshVideoPreviews();
                        }, 200);
                        
                        console.log('所有视频加载完成，当前状态:', uploadedVideos);
                        showAlert('检测到患者已有视频文件，已自动加载', 'success');
                    } else {
                        console.log('部分视频存在，视频状态:', data.videos);
                        // 部分或没有视频，展开上传卡片
                        expandVideoUploadSection();
                        
                        // 更新已存在的视频状态
                        Object.keys(data.videos).forEach(angle => {
                            if (data.videos[angle]) {
                                uploadedVideos[angle] = { url: data.urls[angle], filename: `${angle}.mp4` };
                                updateUploadStatus(angle, 'uploaded');
                                updateVideoPreview(angle, data.urls[angle]);
                                console.log(`视频状态更新: ${angle} =`, uploadedVideos[angle]);
                            }
                        });
                        
                        // 更新状态文本
                        updateUploadStatusText();
                        
                        // 检查所有视频状态并更新界面
                        checkAllVideosUploaded();
                        
                        // 调试信息
                        console.log('当前视频状态:', uploadedVideos);
                        console.log('视频数量:', Object.values(uploadedVideos).filter(video => video !== null).length);
                        
                        // 强制刷新视频预览
                        setTimeout(() => {
                            refreshVideoPreviews();
                        }, 200);
                    }
                } else {
                    console.error('检查患者视频失败:', data.message);
                    showAlert('检查患者视频失败：' + data.message, 'error');
                }
            })
            .catch(error => {
                console.error('检查患者视频网络错误:', error);
                showAlert('检查患者视频失败：' + error.message, 'error');
            });
    }

    function toggleVideoUploadSection() {
        const body = document.getElementById('videoUploadBody');
        const icon = document.getElementById('uploadToggleIcon');
        
        if (body.style.display === 'none') {
            expandVideoUploadSection();
        } else {
            collapseVideoUploadSection();
        }
    }

    function expandVideoUploadSection() {
        const body = document.getElementById('videoUploadBody');
        const icon = document.getElementById('uploadToggleIcon');
        
        if (body) {
            body.style.display = 'block';
            body.classList.add('expanded');
            body.classList.remove('collapsed');
        }
        if (icon) {
            icon.className = 'fas fa-chevron-down';
        }
    }

    function collapseVideoUploadSection() {
        const body = document.getElementById('videoUploadBody');
        const icon = document.getElementById('uploadToggleIcon');
        
        if (body) {
            body.style.display = 'none';
            body.classList.add('collapsed');
            body.classList.remove('expanded');
        }
        if (icon) {
            icon.className = 'fas fa-chevron-right';
        }
    }

    function updateUploadStatusText() {
        const statusText = document.getElementById('uploadStatusText');
        if (!statusText) return;
        
        const uploadedCount = Object.values(uploadedVideos).filter(video => video !== null).length;
        const totalCount = 3;
        
        // 移除所有状态类
        statusText.classList.remove('completed', 'partial', 'pending');
        
        if (uploadedCount === 0) {
            statusText.textContent = '请上传正面、侧面、背面三个角度的视频进行综合分析';
            statusText.classList.add('pending');
        } else if (uploadedCount < totalCount) {
            statusText.textContent = `已上传 ${uploadedCount}/${totalCount} 个视频，请继续上传剩余视频`;
            statusText.classList.add('partial');
        } else {
            statusText.textContent = '所有视频已上传完成，可以开始分析';
            statusText.classList.add('completed');
        }
    }

    function updateVideoPreviews() {
        if (!selectedPatient) return;
        
        // 检查患者视频并更新预览
        fetch(`/api/patients/${selectedPatient.id}/videos/check`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const videos = data.videos;
                    const urls = data.urls;
                    
                    // 更新上传状态和预览
                    Object.keys(videos).forEach(angle => {
                        if (videos[angle]) {
                            // 视频存在，更新状态
                            uploadedVideos[angle] = {
                                file: null,
                                url: urls[angle],
                                filename: `${angle}.mp4`
                            };
                            updateUploadStatus(angle, 'uploaded');
                            
                            // 更新视频预览
                            updateVideoPreview(angle, urls[angle]);
                        } else {
                            // 视频不存在，重置状态
                            uploadedVideos[angle] = null;
                            updateUploadStatus(angle, 'default');
                            
                            // 清除视频预览
                            updateVideoPreview(angle, null);
                        }
                    });
                    
                    // 检查是否所有视频都存在
                    if (data.allExist) {
                        showVideoPreviewSection();
                        collapseVideoUploadSection();
                    } else {
                        expandVideoUploadSection();
                    }
                    
                    // 更新整体状态
                    checkAllVideosUploaded();
                }
            })
            .catch(error => {
                console.error('检查患者视频失败:', error);
            });
    }

    function refreshVideoPreviews() {
        // 强制刷新所有视频预览
        Object.keys(uploadedVideos).forEach(angle => {
            const video = uploadedVideos[angle];
            if (video && video.url) {
                // 重新加载视频
                const videoElement = document.getElementById(angle + 'VideoPreview');
                if (videoElement) {
                    const currentSrc = videoElement.src;
                    videoElement.src = '';
                    videoElement.load();
                    setTimeout(() => {
                        videoElement.src = currentSrc;
                        videoElement.load();
                    }, 50);
                }
            }
        });
        
        // 更新预览区域的显示状态
        const hasVideos = Object.values(uploadedVideos).some(video => video !== null);
        const previewSection = document.getElementById('videoPreviewSection');
        if (previewSection) {
            if (hasVideos) {
                showVideoPreviewSection();
            } else {
                previewSection.style.display = 'none';
            }
        }
    }

    function updateSelectedPatientDisplay() {
        const patientInfo = document.getElementById('selectedPatientInfo');
        const patientAvatar = document.querySelector('.patient-avatar i');
        
        if (selectedPatient && patientInfo) {
            patientInfo.innerHTML = `
                <strong>${selectedPatient.name}</strong> | 
                年龄: ${selectedPatient.age || '未知'} | 
                性别: ${selectedPatient.gender || '未知'} | 
                ID: ${selectedPatient.id}
            `;
        }
        
        if (selectedPatient && patientAvatar) {
            patientAvatar.className = 'fas fa-user-circle fa-2x text-primary';
        }
        
        // 更新患者选择界面状态
        updatePatientSelectionUI();
    }

    function updatePatientSelectionUI() {
        const noPatientSelected = document.getElementById('noPatientSelected');
        const patientSelected = document.getElementById('patientSelected');
        const patientSelectionCard = document.getElementById('patientSelectionCard');
        
        if (selectedPatient) {
            // 有患者选择，显示患者信息
            if (noPatientSelected) noPatientSelected.classList.add('d-none');
            if (patientSelected) patientSelected.classList.remove('d-none');
            if (patientSelectionCard) patientSelectionCard.classList.add('has-patient');
        } else {
            // 没有患者选择，显示提示
            if (noPatientSelected) noPatientSelected.classList.remove('d-none');
            if (patientSelected) patientSelected.classList.add('d-none');
            if (patientSelectionCard) patientSelectionCard.classList.remove('has-patient');
        }
    }

    function updateAnalysisStatusText() {
        const analysisStatusText = document.getElementById('analysisStatusText');
        if (!analysisStatusText) return;
        
        const uploadedCount = Object.values(uploadedVideos).filter(video => video !== null).length;
        const totalCount = 3;
        
        if (uploadedCount === 0) {
            analysisStatusText.textContent = '请先上传视频文件';
            analysisStatusText.className = 'text-muted mt-2';
        } else if (uploadedCount < totalCount) {
            analysisStatusText.textContent = `已上传 ${uploadedCount}/${totalCount} 个视频，请继续上传剩余视频`;
            analysisStatusText.className = 'text-warning mt-2';
        } else {
            analysisStatusText.textContent = '所有视频已上传完成，可以开始分析';
            analysisStatusText.className = 'text-success mt-2';
        }
    }

    function goToCreatePatient() {
        // 跳转到患者管理页面
        window.location.href = '/data_management';
    }

    // 添加缺失的函数
    function showAnalysisControlSection() {
        const controlSection = document.getElementById('analysisControlSection');
        if (controlSection) {
            controlSection.style.display = 'block';
            controlSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function deleteVideo(angle) {
        if (!selectedPatient) {
            showAlert('请先选择患者', 'error');
            return;
        }
        
        if (!uploadedVideos[angle]) {
            showAlert('没有可删除的视频', 'error');
            return;
        }
        
        if (confirm(`确定要删除${angle}角度的视频吗？此操作不可撤销。`)) {
            const filename = `${angle}.mp4`;
            
            fetch(`/api/patients/${selectedPatient.id}/videos/${filename}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // 清除本地状态
                    uploadedVideos[angle] = null;
                    updateUploadStatus(angle, 'default');
                    
                    // 清除视频预览
                    updateVideoPreview(angle, null);
                    
                    // 重置文件输入
                    const fileInput = document.getElementById(angle + 'VideoFile');
                    if (fileInput) {
                        fileInput.value = '';
                    }
                    
                    showAlert(`${angle}角度视频已删除`, 'success');
                    
                    // 检查所有视频状态并更新界面
                    checkAllVideosUploaded();
                    
                    // 强制刷新视频预览区域
                    setTimeout(() => {
                        refreshVideoPreviews();
                    }, 100);
                } else {
                    showAlert('删除失败：' + data.message, 'error');
                }
            })
            .catch(error => {
                showAlert('删除失败：' + error.message, 'error');
            });
        }
    }

    // localStorage相关函数
    function savePatientSelection(patient) {
        try {
            const patientData = {
                id: patient.id,
                name: patient.name,
                age: patient.age,
                gender: patient.gender,
                record_time: patient.record_time,
                timestamp: Date.now()
            };
            localStorage.setItem('ai_video_selected_patient', JSON.stringify(patientData));
            console.log('患者选择已保存到localStorage:', patientData);
        } catch (error) {
            console.error('保存患者选择失败:', error);
        }
    }

    function loadPatientSelection() {
        try {
            const savedData = localStorage.getItem('ai_video_selected_patient');
            if (savedData) {
                const patientData = JSON.parse(savedData);
                
                // 检查数据是否过期（24小时）
                const now = Date.now();
                const savedTime = patientData.timestamp || 0;
                const hoursDiff = (now - savedTime) / (1000 * 60 * 60);
                
                if (hoursDiff > 24) {
                    // 数据过期，清除
                    localStorage.removeItem('ai_video_selected_patient');
                    console.log('患者选择数据已过期，已清除');
                    return null;
                }
                
                console.log('从localStorage加载患者选择:', patientData);
                return patientData;
            }
        } catch (error) {
            console.error('加载患者选择失败:', error);
            // 清除损坏的数据
            localStorage.removeItem('ai_video_selected_patient');
        }
        return null;
    }

    function clearPatientSelection() {
        try {
            localStorage.removeItem('ai_video_selected_patient');
            console.log('患者选择已从localStorage清除');
        } catch (error) {
            console.error('清除患者选择失败:', error);
        }
    }

    function restorePatientSelection() {
        const savedPatient = loadPatientSelection();
        if (savedPatient) {
            // 先加载患者列表，然后恢复选择
            loadPatientsList().then(() => {
                // 检查患者是否仍然存在
                const patient = patientsList.find(p => p.id === savedPatient.id);
                if (patient) {
                    console.log('恢复患者选择:', patient);
                    selectedPatient = patient;
                    updateSelectedPatientDisplay();
                    
                    // 检查患者视频并等待完成
                    console.log('开始检查患者视频...');
                    return checkPatientVideosAsync(patient.id);
                } else {
                    console.log('保存的患者不存在，清除选择');
                    clearPatientSelection();
                    showAlert('之前选择的患者已不存在，请重新选择', 'warning');
                    return Promise.reject('患者不存在');
                }
            }).then(() => {
                console.log('患者视频检查完成，当前视频状态:', uploadedVideos);
                showAlert(`已恢复患者选择: ${selectedPatient.name}`, 'success');
                
                // 加载分析历史记录
                loadAnalysisHistory();
            }).catch(error => {
                console.error('恢复患者选择失败:', error);
                clearPatientSelection();
            });
        }
    }

    // 历史分析记录相关函数
    function loadAnalysisHistory() {
        if (!selectedPatient) {
            showAlert('请先选择患者', 'warning');
            return;
        }
        
        const historyTableBody = document.getElementById('historyTableBody');
        if (!historyTableBody) {
            console.error('找不到历史记录表格');
            return;
        }
        
        // 显示加载状态
        historyTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    正在加载历史记录...
                </td>
            </tr>
        `;
        
        // 调用API获取历史记录
        fetch(`/api/patients/${selectedPatient.id}/analysis_history`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    displayAnalysisHistory(data.data.history_records);
                } else {
                    showAlert('加载历史记录失败: ' + data.message, 'error');
                    historyTableBody.innerHTML = `
                        <tr>
                            <td colspan="4" class="text-center text-muted">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                加载失败: ${data.message}
                            </td>
                        </tr>
                    `;
                }
            })
            .catch(error => {
                console.error('获取历史记录失败:', error);
                showAlert('获取历史记录失败: ' + error.message, 'error');
                historyTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center text-muted">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            网络错误，请重试
                        </td>
                    </tr>
                `;
            });
    }

    function displayAnalysisHistory(historyRecords) {
        const historyTableBody = document.getElementById('historyTableBody');
        const historyCountText = document.getElementById('historyCountText');
        if (!historyTableBody) return;
        
        // 更新报告数量显示
        if (historyCountText) {
            historyCountText.innerHTML = `<i class="fas fa-file-word me-1"></i>共 ${historyRecords.length} 个报告`;
        }
        
        if (!historyRecords || historyRecords.length === 0) {
            historyTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted">
                        <i class="fas fa-file-alt fa-2x mb-2"></i>
                        <br>暂无分析记录
                        <br><small>完成分析后将在此显示报告文件</small>
                    </td>
                </tr>
            `;
            if (historyCountText) {
                historyCountText.innerHTML = `<i class="fas fa-file-word me-1"></i>共 0 个报告`;
            }
            return;
        }
        
        // 清空表格
        historyTableBody.innerHTML = '';
        
        // 添加历史记录行
        historyRecords.forEach(record => {
            const row = document.createElement('tr');
            
            // 格式化文件大小
            const fileSize = formatFileSize(record.file_size);
            
            // 格式化时间
            const timeDisplay = record.modified_time;
            
            row.innerHTML = `
                <td>
                    <i class="fas fa-clock me-2 text-muted"></i>
                    ${timeDisplay}
                </td>
                <td>
                    <i class="fas fa-file-word me-2 text-primary"></i>
                    ${record.filename}
                    <br><small class="text-muted">${fileSize}</small>
                </td>
                <td>
                    <span class="badge bg-success">
                        <i class="fas fa-check me-1"></i>${record.status}
                    </span>
                </td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="downloadReport('${record.download_url}', '${record.filename}')"
                                title="下载报告">
                            <i class="fas fa-download me-1"></i>下载
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="deleteReport('${record.filename}', '${record.modified_time}')"
                                title="删除报告">
                            <i class="fas fa-trash me-1"></i>删除
                        </button>
                    </div>
                </td>
            `;
            
            historyTableBody.appendChild(row);
        });
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 全局函数，供HTML调用
    window.downloadReport = function(downloadUrl, filename) {
        // 显示下载提示
        showAlert(`正在下载: ${filename}`, 'info');
        
        // 使用fetch API获取文件内容
        fetch(downloadUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                // 创建下载链接
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                
                // 添加到DOM并触发下载
                document.body.appendChild(link);
                link.click();
                
                // 清理
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                showAlert(`下载完成: ${filename}`, 'success');
            })
            .catch(error => {
                console.error('下载失败:', error);
                showAlert(`下载失败: ${error.message}`, 'error');
            });
    };

    // 全局函数，供HTML调用 - 下载图片
    window.downloadImage = function(imageUrl, filename) {
        // 显示下载提示
        showAlert(`正在下载: ${filename}`, 'info');
        
        // 使用fetch API获取图片内容
        fetch(imageUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                // 创建下载链接
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                
                // 添加到DOM并触发下载
                document.body.appendChild(link);
                link.click();
                
                // 清理
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                showAlert(`下载完成: ${filename}`, 'success');
            })
            .catch(error => {
                console.error('下载失败:', error);
                showAlert(`下载失败: ${error.message}`, 'error');
            });
    };

    // 全局函数，供HTML调用 - 下载视频
    window.downloadVideo = function(videoUrl, filename) {
        // 显示下载提示
        showAlert(`正在下载: ${filename}`, 'info');
        
        // 使用fetch API获取视频内容
        fetch(videoUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                // 创建下载链接
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                
                // 添加到DOM并触发下载
                document.body.appendChild(link);
                link.click();
                
                // 清理
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                showAlert(`下载完成: ${filename}`, 'success');
            })
            .catch(error => {
                console.error('下载失败:', error);
                showAlert(`下载失败: ${error.message}`, 'error');
            });
    };

    window.deleteReport = function(filename, modifiedTime) {
        if (!selectedPatient) {
            showAlert('请先选择患者', 'error');
            return;
        }
        
        // 确认删除
        const confirmMessage = `确定要删除报告文件 "${filename}" 吗？\n\n生成时间: ${modifiedTime}\n\n此操作不可撤销！`;
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // 调用删除API
        fetch(`/api/patients/${selectedPatient.id}/reports/${filename}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert(`报告文件删除成功: ${filename}`, 'success');
                
                // 删除成功后刷新历史记录
                setTimeout(() => {
                    loadAnalysisHistory();
                }, 500);
            } else {
                showAlert('删除失败: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('删除报告失败:', error);
            showAlert('删除失败: ' + error.message, 'error');
        });
    };

    // 在患者选择后自动加载历史记录
    function selectPatientInternal(patientId) {
        const patient = patientsList.find(p => p.id == patientId);
        if (patient) {
            selectedPatient = patient;
            updateSelectedPatientDisplay();
            savePatientSelection(patient);
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('patientSelectModal'));
            if (modal) {
                modal.hide();
            }
            
            // 检查患者视频
            checkPatientVideosAsync(patient.id).then(() => {
                console.log('患者视频检查完成');
                showAlert(`已选择患者: ${patient.name}`, 'success');
                
                // 加载分析历史记录
                loadAnalysisHistory();
            }).catch(error => {
                console.error('检查患者视频失败:', error);
                showAlert('检查患者视频失败: ' + error.message, 'error');
            });
        } else {
            showAlert('患者不存在', 'error');
        }
    }

    // ==================== 时间轴相关函数 ====================
    
    // 初始化时间轴
    function initializeTimeline(angle) {
        const video = document.getElementById(`${angle}VideoPreview`);
        const timelineControl = document.getElementById(`${angle}TimelineControl`);
        
        console.log(`初始化${angle}角度时间轴`);
        console.log('视频元素:', video);
        console.log('时间轴控件:', timelineControl);
        console.log('视频readyState:', video ? video.readyState : 'N/A');
        console.log('视频duration:', video ? video.duration : 'N/A');
        
        if (!video || !timelineControl) {
            console.log(`${angle}角度时间轴初始化失败：缺少视频元素或时间轴控件`);
            return;
        }
        
        // 等待视频元数据加载完成
        if (video.readyState >= 1 && video.duration > 0) {
            console.log(`${angle}角度视频已加载，直接设置时间轴`);
            setupTimeline(angle, video);
        } else {
            console.log(`${angle}角度视频未加载，等待元数据`);
            video.addEventListener('loadedmetadata', () => {
                console.log(`${angle}角度视频元数据已加载，设置时间轴`);
                setupTimeline(angle, video);
            });
        }
    }
    
    // 设置时间轴
    function setupTimeline(angle, video) {
        const duration = video.duration;
        const data = timelineData[angle];
        
        console.log(`设置${angle}角度时间轴，视频时长: ${duration}`);
        
        if (duration <= 0) {
            console.log(`${angle}角度视频时长无效，跳过时间轴设置`);
            return;
        }
        
        // 初始化时间轴数据
        data.duration = duration;
        data.start = 0;
        data.end = duration;
        
        console.log(`${angle}角度时间轴数据已设置:`, data);
        
        // 更新UI
        updateTimelineUI(angle);
        
        // 绑定拖拽事件
        bindTimelineEvents(angle);
        
        // 显示时间轴控件
        const timelineControl = document.getElementById(`${angle}TimelineControl`);
        if (timelineControl) {
            timelineControl.style.display = 'block';
            console.log(`${angle}角度时间轴控件已显示`);
        } else {
            console.log(`${angle}角度时间轴控件未找到`);
        }
    }
    
    // 更新时间轴UI
    function updateTimelineUI(angle) {
        const data = timelineData[angle];
        const duration = data.duration;
        const start = data.start;
        const end = data.end;
        
        // 更新时长显示
        const durationElement = document.getElementById(`${angle}Duration`);
        if (durationElement) {
            durationElement.textContent = formatTime(duration);
        }
        
        // 更新开始和结束时间显示
        const startElement = document.getElementById(`${angle}StartTime`);
        const endElement = document.getElementById(`${angle}EndTime`);
        if (startElement) startElement.textContent = formatTime(start);
        if (endElement) endElement.textContent = formatTime(end);
        
        // 更新滑块位置
        updateTimelineHandles(angle);
    }
    
    // 更新时间轴滑块位置
    function updateTimelineHandles(angle) {
        const data = timelineData[angle];
        const duration = data.duration;
        const start = data.start;
        const end = data.end;
        
        if (duration <= 0) return;
        
        const startPercent = (start / duration) * 100;
        const endPercent = (end / duration) * 100;
        
        // 更新开始滑块位置
        const startHandle = document.getElementById(`${angle}HandleStart`);
        if (startHandle) {
            startHandle.style.left = `${startPercent}%`;
        }
        
        // 更新结束滑块位置
        const endHandle = document.getElementById(`${angle}HandleEnd`);
        if (endHandle) {
            endHandle.style.right = `${100 - endPercent}%`;
        }
        
        // 更新选择范围
        const range = document.getElementById(`${angle}TimelineRange`);
        if (range) {
            range.style.left = `${startPercent}%`;
            range.style.width = `${endPercent - startPercent}%`;
        }
    }
    
    // 绑定时间轴事件
    function bindTimelineEvents(angle) {
        const startHandle = document.getElementById(`${angle}HandleStart`);
        const endHandle = document.getElementById(`${angle}HandleEnd`);
        const slider = document.getElementById(`${angle}TimelineSlider`);
        
        if (!startHandle || !endHandle || !slider) return;
        
        // 开始滑块拖拽事件
        startHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            timelineData[angle].isDragging = true;
            timelineData[angle].dragHandle = 'start';
            document.addEventListener('mousemove', handleTimelineDrag);
            document.addEventListener('mouseup', handleTimelineDragEnd);
        });
        
        // 结束滑块拖拽事件
        endHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            timelineData[angle].isDragging = true;
            timelineData[angle].dragHandle = 'end';
            document.addEventListener('mousemove', handleTimelineDrag);
            document.addEventListener('mouseup', handleTimelineDragEnd);
        });
        
        // 点击滑块轨道事件
        slider.addEventListener('click', (e) => {
            if (timelineData[angle].isDragging) return;
            
            const rect = slider.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percent = (clickX / rect.width) * 100;
            const time = (percent / 100) * timelineData[angle].duration;
            
            // 判断点击位置更接近哪个滑块
            const startPercent = (timelineData[angle].start / timelineData[angle].duration) * 100;
            const endPercent = (timelineData[angle].end / timelineData[angle].duration) * 100;
            
            if (Math.abs(percent - startPercent) < Math.abs(percent - endPercent)) {
                // 更接近开始滑块
                timelineData[angle].start = Math.max(0, Math.min(time, timelineData[angle].end - 1));
            } else {
                // 更接近结束滑块
                timelineData[angle].end = Math.max(timelineData[angle].start + 1, Math.min(time, timelineData[angle].duration));
            }
            
            updateTimelineUI(angle);
        });
    }
    
    // 处理时间轴拖拽
    function handleTimelineDrag(e) {
        const angles = ['front', 'side', 'back'];
        
        for (const angle of angles) {
            const data = timelineData[angle];
            if (!data.isDragging) continue;
            
            const slider = document.getElementById(`${angle}TimelineSlider`);
            if (!slider) continue;
            
            const rect = slider.getBoundingClientRect();
            const dragX = e.clientX - rect.left;
            const percent = Math.max(0, Math.min(100, (dragX / rect.width) * 100));
            const time = (percent / 100) * data.duration;
            
            if (data.dragHandle === 'start') {
                data.start = Math.max(0, Math.min(time, data.end - 1));
            } else if (data.dragHandle === 'end') {
                data.end = Math.max(data.start + 1, Math.min(time, data.duration));
            }
            
            updateTimelineUI(angle);
        }
    }
    
    // 处理时间轴拖拽结束
    function handleTimelineDragEnd() {
        const angles = ['front', 'side', 'back'];
        
        for (const angle of angles) {
            timelineData[angle].isDragging = false;
            timelineData[angle].dragHandle = null;
        }
        
        document.removeEventListener('mousemove', handleTimelineDrag);
        document.removeEventListener('mouseup', handleTimelineDragEnd);
    }
    
    // 格式化时间显示
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // 重置时间轴
    window.resetTimeline = function(angle) {
        const data = timelineData[angle];
        data.start = 0;
        data.end = data.duration;
        updateTimelineUI(angle);
        showAlert(`${getAngleName(angle)}视频时间轴已重置`, 'success');
    };
    
    // 预览时间轴选择的时间段
    window.previewTimeline = function(angle) {
        const data = timelineData[angle];
        const video = document.getElementById(`${angle}VideoPreview`);
        
        if (!video) return;
        
        // 设置视频播放位置到开始时间
        video.currentTime = data.start;
        
        // 播放视频
        video.play().then(() => {
            // 监听时间更新，在结束时间停止
            const timeUpdateHandler = () => {
                if (video.currentTime >= data.end) {
                    video.pause();
                    video.removeEventListener('timeupdate', timeUpdateHandler);
                }
            };
            video.addEventListener('timeupdate', timeUpdateHandler);
            
            // 添加预览状态样式
            const timelineControl = document.getElementById(`${angle}TimelineControl`);
            if (timelineControl) {
                timelineControl.classList.add('previewing');
                setTimeout(() => {
                    timelineControl.classList.remove('previewing');
                }, 2000);
            }
            
            showAlert(`正在预览${getAngleName(angle)}视频选择的时间段`, 'info');
        }).catch(error => {
            console.error('视频播放失败:', error);
            showAlert('视频播放失败', 'error');
        });
    };
    
    // 获取角度名称
    function getAngleName(angle) {
        const names = {
            front: '正面',
            side: '侧面',
            back: '背面'
        };
        return names[angle] || angle;
    }
    
    // 全局函数：手动初始化时间轴（用于调试）
    window.initTimeline = function(angle) {
        console.log(`手动初始化${angle}角度时间轴`);
        initializeTimeline(angle);
    };
    
    // 全局函数：初始化所有时间轴（用于调试）
    window.initAllTimelines = function() {
        const angles = ['front', 'side', 'back'];
        angles.forEach(angle => {
            const video = document.getElementById(`${angle}VideoPreview`);
            if (video && video.src) {
                console.log(`手动初始化${angle}角度时间轴`);
                initializeTimeline(angle);
            }
        });
    };
    
    // 获取时间轴数据用于分析
    function getTimelineDataForAnalysis() {
        const result = {};
        const angles = ['front', 'side', 'back'];
        
        console.log('当前时间轴数据:', timelineData);
        
        for (const angle of angles) {
            const data = timelineData[angle];
            console.log(`${angle}角度时间轴数据:`, data);
            if (data && data.duration > 0) {
                result[angle] = {
                    start: data.start,
                    end: data.end,
                    duration: data.duration
                };
                console.log(`添加${angle}角度时间轴:`, result[angle]);
            }
        }
        
        console.log('最终时间轴数据:', result);
        return result;
    }
    
});