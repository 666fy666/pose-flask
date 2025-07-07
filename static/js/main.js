// 主要的JavaScript功能文件

$(document).ready(function() {
    // 初始化工具提示
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // 页面加载动画
    $('body').addClass('fade-in');

    // 自动隐藏警告消息
    setTimeout(function() {
        $('.alert').fadeOut('slow');
    }, 5000);

    // 表单验证
    function validateForm(formElement) {
        const requiredFields = formElement.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(function(field) {
            if (!field.value.trim()) {
                field.classList.add('is-invalid');
                isValid = false;
            } else {
                field.classList.remove('is-invalid');
            }
        });

        return isValid;
    }

    // 全局表单验证
    $('form').on('submit', function(e) {
        if (!validateForm(this)) {
            e.preventDefault();
            showAlert('请填写所有必填项', 'danger');
        }
    });

    // 显示警告消息
    function showAlert(message, type = 'info') {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        $('.container').first().prepend(alertHtml);
        
        // 自动隐藏
        setTimeout(function() {
            $('.alert').fadeOut('slow');
        }, 5000);
    }

    // 加载状态管理
    function showLoading(button) {
        const originalText = button.html();
        button.html('<span class="loading"></span> 处理中...');
        button.prop('disabled', true);
        return originalText;
    }

    function hideLoading(button, originalText) {
        button.html(originalText);
        button.prop('disabled', false);
    }

    // AJAX错误处理
    $(document).ajaxError(function(event, xhr, settings, error) {
        console.error('AJAX Error:', error);
        let errorMessage = '请求失败';
        
        if (xhr.responseJSON && xhr.responseJSON.error) {
            errorMessage = xhr.responseJSON.error;
        } else if (xhr.status === 404) {
            errorMessage = '请求的资源不存在';
        } else if (xhr.status === 500) {
            errorMessage = '服务器内部错误';
        } else if (xhr.status === 403) {
            errorMessage = '没有权限执行此操作';
        }
        
        showAlert(errorMessage, 'danger');
    });

    // 确认对话框
    function confirmAction(message, callback) {
        if (confirm(message)) {
            callback();
        }
    }

    // 格式化日期
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN');
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 节流函数
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 本地存储管理
    const StorageManager = {
        set: function(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error('Error saving to localStorage', e);
            }
        },
        
        get: function(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Error reading from localStorage', e);
                return defaultValue;
            }
        },
        
        remove: function(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.error('Error removing from localStorage', e);
            }
        },
        
        clear: function() {
            try {
                localStorage.clear();
            } catch (e) {
                console.error('Error clearing localStorage', e);
            }
        }
    };

    // 表单数据管理
    const FormManager = {
        saveFormData: function(formId, data) {
            StorageManager.set(`form_${formId}`, data);
        },
        
        loadFormData: function(formId) {
            return StorageManager.get(`form_${formId}`, {});
        },
        
        clearFormData: function(formId) {
            StorageManager.remove(`form_${formId}`);
        },
        
        autoSave: function(formId, formElement) {
            const formData = {};
            $(formElement).serializeArray().forEach(function(item) {
                formData[item.name] = item.value;
            });
            this.saveFormData(formId, formData);
        },
        
        restoreForm: function(formId, formElement) {
            const savedData = this.loadFormData(formId);
            Object.keys(savedData).forEach(function(key) {
                const field = formElement.querySelector(`[name="${key}"]`);
                if (field) {
                    field.value = savedData[key];
                }
            });
        }
    };

    // 文件上传管理
    const FileUploadManager = {
        validateFile: function(file, allowedTypes, maxSize) {
            const errors = [];
            
            if (allowedTypes && !allowedTypes.includes(file.type)) {
                errors.push('文件类型不支持');
            }
            
            if (maxSize && file.size > maxSize) {
                errors.push(`文件大小不能超过 ${formatFileSize(maxSize)}`);
            }
            
            return errors;
        },
        
        createPreview: function(file, container) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    container.html(`<img src="${e.target.result}" class="img-fluid" alt="预览">`);
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = URL.createObjectURL(file);
                video.controls = true;
                video.className = 'img-fluid';
                container.html(video);
            }
        }
    };

    // 数据表格管理
    const TableManager = {
        createTable: function(container, data, columns) {
            let tableHtml = '<table class="table table-striped table-hover">';
            
            // 表头
            tableHtml += '<thead><tr>';
            columns.forEach(function(column) {
                tableHtml += `<th>${column.title}</th>`;
            });
            tableHtml += '</tr></thead>';
            
            // 表体
            tableHtml += '<tbody>';
            data.forEach(function(row) {
                tableHtml += '<tr>';
                columns.forEach(function(column) {
                    const value = column.render ? column.render(row[column.key], row) : row[column.key];
                    tableHtml += `<td>${value}</td>`;
                });
                tableHtml += '</tr>';
            });
            tableHtml += '</tbody></table>';
            
            container.html(tableHtml);
        },
        
        addPagination: function(container, currentPage, totalPages, onPageChange) {
            let paginationHtml = '<nav><ul class="pagination justify-content-center">';
            
            // 上一页
            paginationHtml += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">上一页</a>
            </li>`;
            
            // 页码
            for (let i = 1; i <= totalPages; i++) {
                paginationHtml += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>`;
            }
            
            // 下一页
            paginationHtml += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">下一页</a>
            </li>`;
            
            paginationHtml += '</ul></nav>';
            
            container.html(paginationHtml);
            
            // 绑定事件
            container.find('.page-link').on('click', function(e) {
                e.preventDefault();
                const page = parseInt($(this).data('page'));
                if (page >= 1 && page <= totalPages) {
                    onPageChange(page);
                }
            });
        }
    };

    // 图表管理
    const ChartManager = {
        createLineChart: function(canvas, data, options = {}) {
            const ctx = canvas.getContext('2d');
            return new Chart(ctx, {
                type: 'line',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    ...options
                }
            });
        },
        
        createBarChart: function(canvas, data, options = {}) {
            const ctx = canvas.getContext('2d');
            return new Chart(ctx, {
                type: 'bar',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    ...options
                }
            });
        },
        
        createPieChart: function(canvas, data, options = {}) {
            const ctx = canvas.getContext('2d');
            return new Chart(ctx, {
                type: 'pie',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    ...options
                }
            });
        }
    };

    // 导出功能
    const ExportManager = {
        exportToCSV: function(data, filename) {
            const csvContent = this.convertToCSV(data);
            this.downloadFile(csvContent, filename, 'text/csv');
        },
        
        exportToJSON: function(data, filename) {
            const jsonContent = JSON.stringify(data, null, 2);
            this.downloadFile(jsonContent, filename, 'application/json');
        },
        
        convertToCSV: function(data) {
            if (data.length === 0) return '';
            
            const headers = Object.keys(data[0]);
            const csvRows = [headers.join(',')];
            
            data.forEach(function(row) {
                const values = headers.map(function(header) {
                    const value = row[header];
                    return typeof value === 'string' ? `"${value}"` : value;
                });
                csvRows.push(values.join(','));
            });
            
            return csvRows.join('\n');
        },
        
        downloadFile: function(content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    // 全局函数暴露
    window.AppUtils = {
        showAlert,
        showLoading,
        hideLoading,
        confirmAction,
        formatDate,
        formatFileSize,
        debounce,
        throttle,
        StorageManager,
        FormManager,
        FileUploadManager,
        TableManager,
        ChartManager,
        ExportManager
    };

    // 页面特定的初始化
    const currentPage = $('body').data('page');
    if (currentPage) {
        // 根据页面类型执行特定的初始化
        switch (currentPage) {
            case 'data-management':
                initDataManagement();
                break;
            case 'ai-video':
                initAIVideo();
                break;
        }
    }

    function initDataManagement() {
        // 数据管理页面的特定初始化
        console.log('初始化数据管理页面');
    }

    function initAIVideo() {
        // AI视频页面的特定初始化
        console.log('初始化AI视频页面');
    }
}); 