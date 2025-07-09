// 数据管理页面JavaScript

$(document).ready(function() {
    let currentPage = 1;
    let pageSize = 20;
    let totalPages = 1;
    let patients = [];
    let selectedPatients = [];

    // 初始化页面
    initPage();

    // 搜索按钮事件
    $('#searchBtn').click(function() {
        currentPage = 1;
        loadPatients();
    });

    // 刷新按钮事件
    $('#refreshBtn').click(function() {
        loadPatients();
    });

    // 全选/取消全选
    $('#selectAll').change(function() {
        const isChecked = $(this).is(':checked');
        $('.patient-checkbox').prop('checked', isChecked);
        updateSelectedPatients();
    });

    // 导出选中患者
    $('#exportSelectedBtn').click(function() {
        if (selectedPatients.length === 0) {
            showToast('请先选择要导出的患者', 'warning');
            return;
        }
        exportSelectedPatients();
    });

    // 添加患者表单提交
    $('#addPatientForm').submit(function(e) {
        e.preventDefault();
        addPatient();
    });

    // 表单字段验证
    function validatePatientForm() {
        const name = $('#name').val().trim();
        const gender = $('#gender').val();
        const age = $('#age').val();
        const height = $('#height').val();
        const weight = $('#weight').val();
        
        if (!name) {
            showToast('请输入用户名', 'warning');
            $('#name').focus();
            return false;
        }
        
        if (!gender) {
            showToast('请选择性别', 'warning');
            $('#gender').focus();
            return false;
        }
        
        if (!age || age < 0 || age > 150) {
            showToast('请输入有效的年龄(0-150)', 'warning');
            $('#age').focus();
            return false;
        }
        
        if (!height || height < 50 || height > 300) {
            showToast('请输入有效的身高(50-300cm)', 'warning');
            $('#height').focus();
            return false;
        }
        
        if (!weight || weight < 10 || weight > 500) {
            showToast('请输入有效的体重(10-500kg)', 'warning');
            $('#weight').focus();
            return false;
        }
        
        return true;
    }

    // 导出功能按钮事件
    $('#exportExcelBtn').click(function() {
        exportData('excel');
    });

    $('#exportCsvBtn').click(function() {
        exportData('csv');
    });

    $('#exportPdfBtn').click(function() {
        exportData('pdf');
    });

    $('#backupDbBtn').click(function() {
        backupDatabase();
    });

    // 置信度滑块事件
    $('#confidenceThreshold').on('input', function() {
        $('#confidenceValue').text($(this).val() + '%');
    });

    // 初始化页面
    function initPage() {
        loadPatients();
        setupEventListeners();
    }

    // 设置事件监听器
    function setupEventListeners() {
        // 患者复选框变化事件
        $(document).on('change', '.patient-checkbox', function() {
            updateSelectedPatients();
        });

        // 编辑患者事件
        $(document).on('click', '.edit-patient', function() {
            const patientId = $(this).data('id');
            editPatient(patientId);
        });

        // 删除患者事件
        $(document).on('click', '.delete-patient', function() {
            const patientId = $(this).data('id');
            const patientName = $(this).data('name');
            showDeleteConfirm(patientId, patientName);
        });

        // 查看患者详情事件
        $(document).on('click', '.view-patient', function() {
            const patientId = $(this).data('id');
            viewPatient(patientId);
        });

        // 确认删除事件
        $('#confirmDeleteBtn').click(function() {
            const patientId = $(this).data('patient-id');
            deletePatient(patientId);
        });

        // 保存编辑事件
        $('#saveEditBtn').click(function() {
            savePatientEdit();
        });
    }

    // 加载患者列表
    function loadPatients() {
        showLoading('正在加载患者数据...');
        
        const searchName = $('#searchName').val();
        const filterGender = $('#filterGender').val();
        const filterAge = $('#filterAge').val();

        $.ajax({
            url: '/api/patients',
            method: 'GET',
            data: {
                page: currentPage,
                page_size: pageSize,
                search: searchName,
                gender: filterGender,
                age_range: filterAge
            },
            success: function(response) {
                hideLoading();
                if (response.success) {
                    patients = response.data.patients;
                    totalPages = response.data.total_pages;
                    displayPatients();
                    updatePagination();
                } else {
                    showToast(response.message || '加载患者数据失败', 'danger');
                }
            },
            error: function(xhr, status, error) {
                hideLoading();
                console.error('加载患者数据失败:', xhr.responseText);
                showToast('加载患者数据失败: ' + (xhr.responseJSON?.message || error), 'danger');
            }
        });
    }

    // 显示患者列表
    function displayPatients() {
        const tbody = $('#patientsTableBody');
        tbody.empty();

        if (patients.length === 0) {
            tbody.html('<tr><td colspan="11" class="text-center text-muted">暂无患者数据</td></tr>');
            return;
        }

        patients.forEach(function(patient) {
            const bmi = patient.height && patient.weight ? 
                (patient.weight / Math.pow(patient.height / 100, 2)).toFixed(1) : '-';
            
            const row = `
                <tr>
                    <td>
                        <input type="checkbox" class="patient-checkbox" value="${patient.id}">
                    </td>
                    <td>${patient.id}</td>
                    <td>${patient.name || '-'}</td>
                    <td>${patient.gender || '-'}</td>
                    <td>${patient.age || '-'}</td>
                    <td>${patient.height || '-'}</td>
                    <td>${patient.weight || '-'}</td>
                    <td>${bmi}</td>
                    <td>${patient.symptoms || '-'}</td>
                    <td>${patient.project || '-'}</td>
                    <td>
                        <div class="btn-group btn-group-sm" role="group">
                            <button type="button" class="btn btn-outline-primary view-patient" data-id="${patient.id}" title="查看详情">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button type="button" class="btn btn-outline-warning edit-patient" data-id="${patient.id}" title="编辑">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-outline-danger delete-patient" data-id="${patient.id}" data-name="${patient.name || '患者'}" title="删除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
    }

    // 更新分页
    function updatePagination() {
        const pagination = $('#pagination');
        pagination.empty();

        if (totalPages <= 1) return;

        // 上一页
        const prevDisabled = currentPage === 1 ? 'disabled' : '';
        pagination.append(`
            <li class="page-item ${prevDisabled}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `);

        // 页码
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const active = i === currentPage ? 'active' : '';
            pagination.append(`
                <li class="page-item ${active}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `);
        }

        // 下一页
        const nextDisabled = currentPage === totalPages ? 'disabled' : '';
        pagination.append(`
            <li class="page-item ${nextDisabled}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `);

        // 分页点击事件
        pagination.find('.page-link').click(function(e) {
            e.preventDefault();
            const page = $(this).data('page');
            if (page && page !== currentPage) {
                currentPage = page;
                loadPatients();
            }
        });
    }

    // 更新选中的患者
    function updateSelectedPatients() {
        selectedPatients = [];
        $('.patient-checkbox:checked').each(function() {
            selectedPatients.push($(this).val());
        });
        
        $('#exportSelectedBtn').prop('disabled', selectedPatients.length === 0);
    }

    // 添加患者
    function addPatient() {
        if (!validatePatientForm()) {
            return;
        }
        
        const formData = {};
        $('#addPatientForm').serializeArray().forEach(function(item) {
            formData[item.name] = item.value;
        });

        showLoading('正在添加患者...');

        $.ajax({
            url: '/api/patients',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(response) {
                hideLoading();
                if (response.success) {
                    showToast('患者添加成功', 'success');
                    $('#addPatientForm')[0].reset();
                    loadPatients();
                    // 切换到患者管理标签页
                    $('#patients-tab').tab('show');
                } else {
                    showToast(response.message || '患者添加失败', 'danger');
                }
            },
            error: function(xhr, status, error) {
                hideLoading();
                console.error('添加患者失败:', xhr.responseText);
                showToast('患者添加失败: ' + (xhr.responseJSON?.message || error), 'danger');
            }
        });
    }

    // 编辑患者
    function editPatient(patientId) {
        const patient = patients.find(p => p.id == patientId);
        if (!patient) {
            showToast('患者信息不存在', 'danger');
            return;
        }

        $('#editPatientId').val(patient.id);
        $('#editName').val(patient.name);
        $('#editGender').val(patient.gender);
        $('#editAge').val(patient.age);
        $('#editHeight').val(patient.height);
        $('#editWeight').val(patient.weight);
        $('#editAddress').val(patient.address);
        $('#editSymptoms').val(patient.symptoms);
        $('#editDuration').val(patient.duration);
        $('#editTreatment').val(patient.treatment);
        $('#editProject').val(patient.project);
        $('#editFillPerson').val(patient.fill_person);

        $('#editPatientModal').modal('show');
    }

    // 保存患者编辑
    function savePatientEdit() {
        const formData = {};
        $('#editPatientForm').serializeArray().forEach(function(item) {
            formData[item.name] = item.value;
        });

        showLoading('正在保存修改...');

        $.ajax({
            url: '/api/patients/' + formData.id,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(response) {
                hideLoading();
                if (response.success) {
                    showToast('患者信息更新成功', 'success');
                    $('#editPatientModal').modal('hide');
                    loadPatients();
                } else {
                    showToast(response.message || '更新失败', 'danger');
                }
            },
            error: function(xhr, status, error) {
                hideLoading();
                console.error('更新患者失败:', xhr.responseText);
                showToast('更新失败: ' + (xhr.responseJSON?.message || error), 'danger');
            }
        });
    }

    // 显示删除确认
    function showDeleteConfirm(patientId, patientName) {
        $('#deletePatientName').text(patientName);
        $('#confirmDeleteBtn').data('patient-id', patientId);
        $('#deleteConfirmModal').modal('show');
    }

    // 删除患者
    function deletePatient(patientId) {
        showLoading('正在删除患者...');

        $.ajax({
            url: '/api/patients/' + patientId,
            method: 'DELETE',
            success: function(response) {
                hideLoading();
                if (response.success) {
                    showToast('患者删除成功', 'success');
                    $('#deleteConfirmModal').modal('hide');
                    loadPatients();
                } else {
                    showToast(response.message || '删除失败', 'danger');
                }
            },
            error: function(xhr, status, error) {
                hideLoading();
                console.error('删除患者失败:', xhr.responseText);
                showToast('删除失败: ' + (xhr.responseJSON?.message || error), 'danger');
            }
        });
    }

    // 查看患者详情
    function viewPatient(patientId) {
        const patient = patients.find(p => p.id == patientId);
        if (!patient) {
            showToast('患者信息不存在', 'danger');
            return;
        }

        // 这里可以实现查看患者详情的功能
        showToast('查看患者详情功能待实现', 'info');
    }

    // 导出选中的患者
    function exportSelectedPatients() {
        if (selectedPatients.length === 0) {
            showToast('请先选择要导出的患者', 'warning');
            return;
        }

        showLoading('正在导出数据...');

        $.ajax({
            url: '/api/export_patients',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                patient_ids: selectedPatients,
                format: 'excel'
            }),
            success: function(response) {
                hideLoading();
                if (response.success) {
                    // 使用fetch API下载文件
                    downloadFile(response.download_url, response.filename);
                    showToast('导出成功', 'success');
                } else {
                    showToast(response.message || '导出失败', 'danger');
                }
            },
            error: function() {
                hideLoading();
                showToast('导出失败', 'danger');
            }
        });
    }

    // 导出数据
    function exportData(format) {
        showLoading('正在导出数据...');

        $.ajax({
            url: '/api/export_data',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                format: format
            }),
            success: function(response) {
                hideLoading();
                if (response.success) {
                    // 使用fetch API下载文件
                    downloadFile(response.download_url, response.filename);
                    showToast('导出成功', 'success');
                } else {
                    showToast(response.message || '导出失败', 'danger');
                }
            },
            error: function() {
                hideLoading();
                showToast('导出失败', 'danger');
            }
        });
    }

    // 备份数据库
    function backupDatabase() {
        showLoading('正在备份数据库...');

        $.ajax({
            url: '/api/backup_database',
            method: 'POST',
            success: function(response) {
                hideLoading();
                if (response.success) {
                    // 使用fetch API下载文件
                    downloadFile(response.download_url, response.filename);
                    showToast('数据库备份成功', 'success');
                } else {
                    showToast(response.message || '备份失败', 'danger');
                }
            },
            error: function() {
                hideLoading();
                showToast('备份失败', 'danger');
            }
        });
    }

    // 通用文件下载函数
    function downloadFile(downloadUrl, filename) {
        // 显示下载提示
        showToast(`正在下载: ${filename}`, 'info');
        
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
                
                showToast(`下载完成: ${filename}`, 'success');
            })
            .catch(error => {
                console.error('下载失败:', error);
                showToast(`下载失败: ${error.message}`, 'error');
            });
    }
}); 