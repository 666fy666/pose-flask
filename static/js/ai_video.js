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

    // 初始化页面
    initializePage();
    
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
            changePatientBtn.addEventListener('click', showPatientSelectModal);
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
        
        // 绑定全局selectPatient事件
        document.addEventListener('selectPatient', function(event) {
            const patientId = event.detail.patientId;
            selectPatientInternal(patientId);
        });
        
        // 绑定下拉式卡片点击事件
        const videoUploadHeader = document.getElementById('videoUploadHeader');
        if (videoUploadHeader) {
            videoUploadHeader.addEventListener('click', toggleVideoUploadSection);
        }
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
                updateVideoPreview(angle, data.url);
                
                // 显示相应的成功消息
                if (data.replaced) {
                    showAlert(`${angle}角度视频已重新上传并覆盖原文件`, 'success');
                } else {
                    showAlert(`${angle}角度视频上传成功`, 'success');
                }
                
                checkAllVideosUploaded();
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
            videoElement.src = url;
            videoElement.load();
        }
    }

    function checkAllVideosUploaded() {
        const allUploaded = Object.values(uploadedVideos).every(video => video !== null);
        const startMultiAnalysisBtn = document.getElementById('startMultiAnalysisBtn');
        
        if (startMultiAnalysisBtn) {
            startMultiAnalysisBtn.disabled = !allUploaded;
        }

        // 更新上传状态文本
        updateUploadStatusText();
        
        // 更新分析状态文本
        updateAnalysisStatusText();

        if (allUploaded) {
            showVideoPreviewSection();
            
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
        
        // 原有的分析逻辑
        if (Object.values(uploadedVideos).every(video => video !== null)) {
            showAnalysisControlSection();
        } else {
            showAlert('请先上传所有角度的视频', 'error');
        }
    }

    function startAnalysis() {
        if (!selectedPatient) {
            showAlert('请先选择患者', 'error');
            return;
        }
        
        // 原有的分析逻辑
        if (analysisInProgress) {
            showAlert('分析正在进行中，请稍候', 'warning');
            return;
        }
        
        // 检查是否有上传的视频
        const hasVideos = Object.values(uploadedVideos).some(video => video !== null);
        if (!hasVideos) {
            showAlert('请先上传至少一个视频', 'error');
            return;
        }
        
        // 开始分析
        analysisInProgress = true;
        updateAnalysisButtons(true);
        
        const analysisType = document.getElementById('analysisType').value;
        const confidenceThreshold = document.getElementById('confidenceThreshold').value;
        
        const analysisData = {
            videos: uploadedVideos,
            analysisType: analysisType,
            confidenceThreshold: parseInt(confidenceThreshold),
            patientId: selectedPatient.id
        };
        
        fetch('/api/analyze_video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(analysisData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentAnalysisId = data.analysisId;
                showAnalysisResultSection();
                displayAnalysisResults(data.results);
                showAlert('分析完成', 'success');
            } else {
                showAlert('分析失败：' + data.message, 'error');
            }
        })
        .catch(error => {
            showAlert('分析失败：' + error.message, 'error');
        })
        .finally(() => {
            analysisInProgress = false;
            updateAnalysisButtons(false);
        });
    }

    function stopAnalysis() {
        if (currentAnalysisId) {
            fetch(`/api/stop_analysis/${currentAnalysisId}`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('分析已停止', 'info');
                    updateAnalysisButtons(false);
                }
            })
            .catch(error => {
                showAlert('停止分析失败：' + error.message, 'error');
            });
        }
    }

    function updateAnalysisButtons(analyzing) {
        const startBtn = document.getElementById('startAnalysisBtn');
        const stopBtn = document.getElementById('stopAnalysisBtn');
        const exportBtn = document.getElementById('exportResultBtn');

        if (startBtn) startBtn.style.display = analyzing ? 'none' : 'inline-block';
        if (stopBtn) stopBtn.style.display = analyzing ? 'inline-block' : 'none';
        if (exportBtn) exportBtn.style.display = analyzing ? 'none' : 'inline-block';
    }

    function showAnalysisResultSection() {
        const resultSection = document.getElementById('analysisResultSection');
        if (resultSection) {
            resultSection.style.display = 'block';
            resultSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function displayAnalysisResults(results) {
        // 显示各角度分析结果
        displayAngleResult('front', results.front);
        displayAngleResult('side', results.side);
        displayAngleResult('back', results.back);
        
        // 显示综合分析结果
        displayComprehensiveResult(results.comprehensive);
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
        fetch('/api/patients/select')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    patientsList = data.data;
                    displayPatientsList(patientsList);
                } else {
                    showAlert('加载患者列表失败：' + data.message, 'error');
                }
            })
            .catch(error => {
                showAlert('加载患者列表失败：' + error.message, 'error');
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
                    <button class="btn btn-sm btn-primary" onclick="selectPatient(${patient.id})">
                        <i class="fas fa-check me-1"></i>选择
                    </button>
                </td>
            </tr>
        `).join('');
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
                updateSelectedPatientDisplay();
                
                // 关闭模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('patientSelectModal'));
                if (modal) {
                    modal.hide();
                }
                
                showAlert('患者选择成功，文件夹已创建', 'success');
                
                // 检查患者是否已有视频文件
                checkPatientVideos(patientId);
            } else {
                showAlert('创建患者文件夹失败：' + data.message, 'error');
            }
        })
        .catch(error => {
            showAlert('创建患者文件夹失败：' + error.message, 'error');
        });
    }

    function checkPatientVideos(patientId) {
        fetch(`/api/patients/${patientId}/videos/check`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (data.allExist) {
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
                        updateVideoPreviews();
                        
                        // 收起上传卡片
                        collapseVideoUploadSection();
                        
                        showAlert('检测到患者已有视频文件，已自动加载', 'success');
                    } else {
                        // 部分或没有视频，展开上传卡片
                        expandVideoUploadSection();
                        
                        // 更新已存在的视频状态
                        Object.keys(data.videos).forEach(angle => {
                            if (data.videos[angle]) {
                                uploadedVideos[angle] = { url: data.urls[angle], filename: `${angle}.mp4` };
                                updateUploadStatus(angle, 'uploaded');
                                updateVideoPreview(angle, data.urls[angle]);
                            }
                        });
                        
                        // 更新状态文本
                        updateUploadStatusText();
                        
                        checkAllVideosUploaded();
                    }
                } else {
                    showAlert('检查患者视频失败：' + data.message, 'error');
                }
            })
            .catch(error => {
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
                            const videoElement = document.getElementById(angle + 'VideoPreview');
                            if (videoElement) {
                                videoElement.src = urls[angle];
                                videoElement.load();
                            }
                        } else {
                            // 视频不存在，重置状态
                            uploadedVideos[angle] = null;
                            updateUploadStatus(angle, 'default');
                            
                            // 清除视频预览
                            const videoElement = document.getElementById(angle + 'VideoPreview');
                            if (videoElement) {
                                videoElement.src = '';
                            }
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
                    const videoElement = document.getElementById(angle + 'VideoPreview');
                    if (videoElement) {
                        videoElement.src = '';
                    }
                    
                    // 重置文件输入
                    const fileInput = document.getElementById(angle + 'VideoFile');
                    if (fileInput) {
                        fileInput.value = '';
                    }
                    
                    showAlert(`${angle}角度视频已删除`, 'success');
                    checkAllVideosUploaded();
                } else {
                    showAlert('删除失败：' + data.message, 'error');
                }
            })
            .catch(error => {
                showAlert('删除失败：' + error.message, 'error');
            });
        }
    }
});

// 全局函数，供HTML调用
function selectPatient(patientId) {
    // 触发页面上的selectPatient函数
    const event = new CustomEvent('selectPatient', { detail: { patientId: patientId } });
    document.dispatchEvent(event);
} 