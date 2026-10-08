/**
 * Hệ thống in tem giá POPUP Siêu thị (TV & Tủ Lạnh A5 + Gia Dụng A6)
 * Tự động đồng bộ từ Excel / Ảnh chụp OCR - Tối ưu 100% In Trắng Đen
 * MỖI TEM LÀ 1 SẢN PHẨM RIÊNG BIỆT - TUYỆT ĐỐI KHÔNG BỊ TRÙNG LẶP SẢN PHẨM
 */

class App {
    constructor() {
        this.products = [...DEFAULT_PRODUCTS];
        this.currentRegion = 'Vùng Hồ Chí Minh';
        this.selectedGroup = 'all';
        this.searchKeyword = '';
        this.currentProductIndex = 0; // Vị trí sản phẩm xem trước hiện tại (0 -> products.length - 1)
        this.layoutMode = 'single'; // 'single' (Mặc định: 1 tem / trang, chuẩn Miền Tây 2, không bao giờ trùng lặp) hoặc 'multi'

        // Chọn mẫu tem: 'tvtl_a5' (TV & Tủ Lạnh A5) hoặc 'giadung_a6' (Gia Dụng A6)
        this.templateType = 'tvtl_a5';

        // Tùy chọn banner & nội dung
        this.bannerMode = 'svg';
        this.customTitleText = 'GIÁ RẺ QUÁ';
        this.bannerTheme = 'bw_classic';
        this.customSubline = '+ TRẢ GÓP 0%';
        this.uploadedBannerUrl = null;
        this.customDateText = 'ÁP DỤNG: 09/10 - 11/10';

        this.init();
    }

    init() {
        this.bindEvents();
        this.renderTable();
        this.updatePreview();
    }

    updateRegionList() {
        // Tự động nhận diện dữ liệu
    }

    getFilteredProducts() {
        return this.products.filter(item => {
            const nhomLower = (item.nhom || '').toLowerCase();
            const tenSPLower = (item.tenSP || '').toLowerCase();

            // Nhận diện hàng Gia Dụng
            const isGiaDung = nhomLower.includes('gia dụng') || 
                              nhomLower.includes('gd') ||
                              tenSPLower.includes('nồi') ||
                              tenSPLower.includes('chảo') ||
                              tenSPLower.includes('bếp') ||
                              tenSPLower.includes('bình đun') ||
                              tenSPLower.includes('lò vi sóng') ||
                              tenSPLower.includes('quạt') ||
                              tenSPLower.includes('máy xay') ||
                              tenSPLower.includes('lọc nước');

            // Nhận diện hàng TV, Tủ Lạnh, Điện Máy Lớn
            const isTvTl = nhomLower.includes('tivi') || 
                           nhomLower.includes('tv') || 
                           nhomLower.includes('tủ lạnh') || 
                           nhomLower.includes('tủ mát') || 
                           nhomLower.includes('tủ đông') || 
                           nhomLower.includes('máy giặt') ||
                           nhomLower.includes('loa') ||
                           tenSPLower.includes('tivi') || 
                           tenSPLower.includes('tủ lạnh') ||
                           tenSPLower.includes('sony') ||
                           (tenSPLower.includes('samsung') && tenSPLower.includes('tv'));

            // KHI CHỌN GIA DỤNG A6: TỰ ĐỘNG LẤY DỮ LIỆU GIA DỤNG, LOẠI BỎ NGÀNH HÀNG KHÁC
            if (this.templateType === 'giadung_a6') {
                if (!isGiaDung && isTvTl) return false;
            } else if (this.templateType === 'tvtl_a5') {
                // KHI CHỌN TV/TL A5: LOẠI BỎ HÀNG GIA DỤNG NHỎ
                if (isGiaDung && !isTvTl) return false;
            }

            if (this.searchKeyword) {
                const kw = this.searchKeyword.toLowerCase();
                const matchName = tenSPLower.includes(kw);
                const matchCode = (item.maSP || '').toLowerCase().includes(kw);
                const matchNhom = nhomLower.includes(kw);
                if (!matchName && !matchCode && !matchNhom) return false;
            }

            return true;
        });
    }

    getBannerContent() {
        if (this.bannerMode === 'upload' && this.uploadedBannerUrl) {
            return `<img src="${this.uploadedBannerUrl}" style="width:100%; height:100%; object-fit:contain;" alt="Banner" />`;
        }
        return BannerGenerator.getBannerSVG(this.customTitleText, this.bannerTheme);
    }

    // NGÀY ÁP DỤNG (Ví dụ: ÁP DỤNG: 09/10 - 11/10)
    getDateText(item) {
        if (this.customDateText) {
            return this.customDateText.toUpperCase();
        }
        return 'ÁP DỤNG: 09/10 - 11/10';
    }

    // Hiển thị xem trước trang in trên màn hình (Live Preview)
    updatePreview() {
        const filtered = this.getFilteredProducts();
        const previewContainer = document.getElementById('previewPaperSheet');
        const previewIndexLabel = document.getElementById('previewIndexLabel');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const statusBadge = document.getElementById('previewStatusBadge');

        if (!filtered || filtered.length === 0) {
            previewContainer.innerHTML = `
                <div style="padding: 60px 20px; text-align: center; color: #64748b;">
                    <p style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">Không có sản phẩm nào phù hợp</p>
                    <p style="font-size: 13px;">Vui lòng đổi bộ lọc hoặc tải file dữ liệu.</p>
                </div>
            `;
            if (previewIndexLabel) previewIndexLabel.textContent = '0 / 0';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return;
        }

        const bannerContent = this.getBannerContent();

        if (this.layoutMode === 'single') {
            // CHẾ ĐỘ 1 TEM / TRANG (CHUẨN MIỀN TÂY 2 - CHỈ 1 TEM DUY NHẤT, KHÔNG TRÙNG LẶP)
            if (this.currentProductIndex >= filtered.length) {
                this.currentProductIndex = 0;
            } else if (this.currentProductIndex < 0) {
                this.currentProductIndex = filtered.length - 1;
            }

            const currentItem = filtered[this.currentProductIndex];

            if (previewIndexLabel) {
                previewIndexLabel.textContent = `Sản phẩm ${this.currentProductIndex + 1} / ${filtered.length}`;
            }
            if (prevBtn) prevBtn.disabled = filtered.length <= 1;
            if (nextBtn) nextBtn.disabled = filtered.length <= 1;

            previewContainer.className = 'paper-sheet layout-single';

            if (this.templateType === 'tvtl_a5') {
                previewContainer.classList.add('template-tvtl');
                previewContainer.innerHTML = this.renderSingleLabelHTML(currentItem, bannerContent, this.getDateText(currentItem), 'tvtl_a5');
                if (statusBadge) statusBadge.textContent = `A5 TV & TL (1 tem / trang)`;
            } else {
                previewContainer.classList.add('template-giadung');
                previewContainer.innerHTML = this.renderSingleLabelHTML(currentItem, bannerContent, this.getDateText(currentItem), 'giadung_a6');
                if (statusBadge) statusBadge.textContent = `A6 Gia Dụng (1 tem / trang)`;
            }
        } else {
            // CHẾ ĐỘ GHÉP NHIỀU TEM / TỜ A4 (CÁC SẢN PHẨM KHÁC NHAU, KHÔNG TRÙNG LẶP)
            const itemsPerSheet = this.templateType === 'tvtl_a5' ? 2 : 4;
            const totalSheets = Math.ceil(filtered.length / itemsPerSheet);

            const sheetIndex = Math.floor(this.currentProductIndex / itemsPerSheet);
            const startIndex = sheetIndex * itemsPerSheet;
            const currentSheetItems = filtered.slice(startIndex, startIndex + itemsPerSheet);

            if (previewIndexLabel) {
                previewIndexLabel.textContent = `Trang ${sheetIndex + 1} / ${totalSheets}`;
            }
            if (prevBtn) prevBtn.disabled = totalSheets <= 1;
            if (nextBtn) nextBtn.disabled = totalSheets <= 1;

            previewContainer.className = 'paper-sheet size-a4';

            if (this.templateType === 'tvtl_a5') {
                previewContainer.classList.add('template-tvtl');
                const item1 = currentSheetItems[0];
                const item2 = currentSheetItems[1];
                previewContainer.innerHTML = `
                    ${this.renderSingleLabelHTML(item1, bannerContent, this.getDateText(item1), 'tvtl_a5')}
                    ${item2 ? this.renderSingleLabelHTML(item2, bannerContent, this.getDateText(item2), 'tvtl_a5') : '<div style="height: 505px; border: 2px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 14px;">(Nửa dưới để trống - Không trùng sản phẩm)</div>'}
                `;
                if (statusBadge) {
                    statusBadge.textContent = item2 ? `A5 TV & TL (2 tem khác nhau / tờ)` : `A5 TV & TL (1 tem / tờ)`;
                }
            } else {
                previewContainer.classList.add('template-giadung');
                let html = '';
                for (let i = 0; i < 4; i++) {
                    const it = currentSheetItems[i];
                    if (it) {
                        html += this.renderSingleLabelHTML(it, bannerContent, this.getDateText(it), 'giadung_a6');
                    } else {
                        html += `<div style="height: 505px; border: 2px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 13px;">(Ô trống)</div>`;
                    }
                }
                previewContainer.innerHTML = html;
                if (statusBadge) {
                    statusBadge.textContent = `A6 Gia Dụng (${currentSheetItems.length} tem khác nhau / tờ)`;
                }
            }
        }

        this.bindInlineEditEvents(previewContainer);
    }

    // Tạo HTML cho 1 tem nhãn
    renderSingleLabelHTML(item, bannerContent, dateText, type = 'tvtl_a5') {
        const giaNiemYetStr = ExcelParser.formatPrice(item.giaNiemYet);
        const giaEventStr = ExcelParser.formatPrice(item.giaEvent);
        const subline = this.customSubline || '+ TRẢ GÓP 0%';

        if (type === 'tvtl_a5') {
            return `
                <div class="label-box format-a5" data-item-id="${item.id}">
                    <div class="label-banner">${bannerContent}</div>
                    <div class="txt-price-strike">
                        <span class="strike-number editable-field" contenteditable="true" data-field="giaNiemYet" title="Nhấp để sửa giá niêm yết">${giaNiemYetStr}</span>
                        <div class="strike-bar"></div>
                    </div>
                    <div class="txt-price-promo editable-field" contenteditable="true" data-field="giaEvent" title="Nhấp để sửa giá khuyến mãi">${giaEventStr}</div>
                    <div class="txt-subline editable-field" contenteditable="true" data-field="subline" title="Nhấp để sửa ưu đãi">${subline}</div>
                    <div class="label-footer">
                        <input type="text" class="input-product-name editable-field" data-field="tenSP" value="${item.tenSP || 'TÊN SẢN PHẨM'}" title="Nhấp để sửa tên sản phẩm" />
                        <input type="text" class="input-print-date editable-field" data-field="dateText" value="${dateText}" title="Nhấp để sửa ngày áp dụng" />
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="label-box format-gd-a6" data-item-id="${item.id}">
                    <div class="label-banner">${bannerContent}</div>
                    <input type="text" class="gd-tsp editable-field" data-field="tenSP" value="${item.tenSP || 'TÊN SẢN PHẨM'}" title="Nhấp để sửa tên sản phẩm" />
                    <div class="gd-gg">
                        <span class="strike-number editable-field" contenteditable="true" data-field="giaNiemYet" title="Nhấp để sửa giá">${giaNiemYetStr}</span>
                        <div class="strike-bar"></div>
                    </div>
                    <div class="gd-gc editable-field" contenteditable="true" data-field="giaEvent" title="Nhấp để sửa giá khuyến mãi">${giaEventStr}</div>
                    <div class="gd-htr editable-field" contenteditable="true" data-field="subline" title="Nhấp để sửa trả góp">${subline}</div>
                    <input type="text" class="gd-pdat editable-field" data-field="dateText" value="${dateText}" title="Nhấp để sửa ngày áp dụng" />
                </div>
            `;
        }
    }

    bindInlineEditEvents(container) {
        container.querySelectorAll('.editable-field').forEach(el => {
            el.addEventListener('blur', () => {
                const labelBox = el.closest('.label-box');
                const itemId = labelBox?.getAttribute('data-item-id');
                const field = el.getAttribute('data-field');
                if (!itemId || !field) return;

                const targetItem = this.products.find(p => p.id === itemId);
                if (!targetItem) return;

                let val = el.tagName === 'INPUT' ? el.value : el.textContent.trim();

                if (field === 'giaNiemYet') {
                    targetItem.giaNiemYet = ExcelParser.parsePrice(val);
                    el.textContent = ExcelParser.formatPrice(targetItem.giaNiemYet);
                } else if (field === 'giaEvent') {
                    targetItem.giaEvent = ExcelParser.parsePrice(val);
                    el.textContent = ExcelParser.formatPrice(targetItem.giaEvent);
                } else if (field === 'tenSP') {
                    targetItem.tenSP = val;
                } else if (field === 'subline') {
                    this.customSubline = val;
                }

                this.renderTable();
            });
        });
    }

    renderTable() {
        const tableBody = document.getElementById('productTableBody');
        const selectedCountEl = document.getElementById('selectedCountLabel');
        const totalCountEl = document.getElementById('totalCountLabel');
        const filtered = this.getFilteredProducts();

        if (totalCountEl) totalCountEl.textContent = `${filtered.length} sản phẩm`;
        
        const selectedCount = filtered.filter(p => p.selected).length;
        if (selectedCountEl) {
            const pageEstimate = this.layoutMode === 'single'
                ? selectedCount
                : Math.ceil(selectedCount / (this.templateType === 'tvtl_a5' ? 2 : 4));
            selectedCountEl.textContent = `Đã chọn: ${selectedCount} sản phẩm (~ ${pageEstimate} trang in)`;
        }

        if (!tableBody) return;

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:#94a3b8;">Không có sản phẩm nào phù hợp bộ lọc.</td></tr>`;
            return;
        }

        tableBody.innerHTML = filtered.map((item, idx) => {
            const isCurrent = this.layoutMode === 'single'
                ? idx === this.currentProductIndex
                : Math.floor(idx / (this.templateType === 'tvtl_a5' ? 2 : 4)) === Math.floor(this.currentProductIndex / (this.templateType === 'tvtl_a5' ? 2 : 4));
            const diff = item.giaNiemYet - item.giaEvent;
            const percent = item.giaNiemYet > 0 ? Math.round((diff / item.giaNiemYet) * 100) : 0;

            return `
                <tr class="${isCurrent ? 'active-row' : ''}">
                    <td class="col-checkbox">
                        <input type="checkbox" class="row-select" data-id="${item.id}" ${item.selected ? 'checked' : ''} />
                    </td>
                    <td><span class="badge-group">${item.nhom || '-'}</span></td>
                    <td style="font-family: monospace; font-size: 11px; color: #475569;">${item.maSP || '-'}</td>
                    <td style="font-weight: 600; max-width: 260px;">
                        ${item.tenSP || '-'}
                        <div style="font-size: 11px; color: #64748b; font-weight: normal;">${item.khungGio || ''}</div>
                    </td>
                    <td>
                        <span class="price-strike-val">${ExcelParser.formatPrice(item.giaNiemYet)}</span>
                    </td>
                    <td>
                        <span class="price-promo-val">${ExcelParser.formatPrice(item.giaEvent)}</span>
                        ${percent > 0 ? `<span class="badge-discount">-${percent}%</span>` : ''}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn-table-action" data-action="preview" data-idx="${idx}">Xem tem</button>
                    </td>
                </tr>
            `;
        }).join('');

        tableBody.querySelectorAll('.row-select').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.getAttribute('data-id');
                const item = this.products.find(p => p.id === id);
                if (item) item.selected = cb.checked;
                this.renderTable();
            });
        });

        tableBody.querySelectorAll('button[data-action="preview"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                this.currentProductIndex = idx;
                this.updatePreview();
                this.renderTable();
                document.getElementById('previewPaperSheet')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        });
    }

    // Chuẩn bị toàn bộ các trang in - MỖI TEM LÀ 1 SẢN PHẨM KHÁC NHAU, KHÔNG TRÙNG LẶP
    preparePrintSheets(targetItems) {
        const printContainer = document.getElementById('printContainer');
        if (!printContainer) return;

        printContainer.innerHTML = '';
        const bannerContent = this.getBannerContent();

        if (this.layoutMode === 'single') {
            // CHẾ ĐỘ 1 TEM / TRANG (CHUẨN MIỀN TÂY 2 - TUYỆT ĐỐI KHÔNG TRÙNG LẶP)
            for (const item of targetItems) {
                const sheet = document.createElement('div');
                sheet.className = `print-sheet size-a4 layout-single template-${this.templateType === 'tvtl_a5' ? 'tvtl' : 'giadung'}`;
                sheet.innerHTML = this.renderSingleLabelHTML(item, bannerContent, this.getDateText(item), this.templateType);
                printContainer.appendChild(sheet);
            }
        } else {
            // CHẾ ĐỘ GHÉP NHIỀU TEM KHÁC NHAU / TỜ A4 (TUYỆT ĐỐI KHÔNG TRÙNG SẢN PHẨM)
            const itemsPerSheet = this.templateType === 'tvtl_a5' ? 2 : 4;
            for (let i = 0; i < targetItems.length; i += itemsPerSheet) {
                const sheet = document.createElement('div');
                sheet.className = `print-sheet size-a4 template-${this.templateType === 'tvtl_a5' ? 'tvtl' : 'giadung'}`;
                let html = '';
                for (let j = 0; j < itemsPerSheet; j++) {
                    const it = targetItems[i + j];
                    if (it) {
                        html += this.renderSingleLabelHTML(it, bannerContent, this.getDateText(it), this.templateType);
                    }
                }
                sheet.innerHTML = html;
                printContainer.appendChild(sheet);
            }
        }
    }

    printAllSelected() {
        const filtered = this.getFilteredProducts();
        const selected = filtered.filter(p => p.selected);

        if (selected.length === 0) {
            alert('Vui lòng chọn ít nhất 1 sản phẩm để in!');
            return;
        }

        this.preparePrintSheets(selected);
        window.print();
    }

    // In riêng ĐÚNG 1 SẢN PHẨM ĐANG CHỌN (KHÔNG NHÂN ĐÔI, CHỈ 1 TEM DUY NHẤT)
    printCurrentSingle() {
        const filtered = this.getFilteredProducts();
        if (filtered.length === 0) return;

        const currentItem = filtered[this.currentProductIndex] || filtered[0];
        const printContainer = document.getElementById('printContainer');
        if (!printContainer) return;

        printContainer.innerHTML = '';
        const bannerContent = this.getBannerContent();

        const sheet = document.createElement('div');
        sheet.className = `print-sheet size-a4 layout-single template-${this.templateType === 'tvtl_a5' ? 'tvtl' : 'giadung'}`;
        sheet.innerHTML = this.renderSingleLabelHTML(currentItem, bannerContent, this.getDateText(currentItem), this.templateType);
        printContainer.appendChild(sheet);

        window.print();
    }

    bindEvents() {
        // Chuyển Tab nguồn nạp: Excel, Hình Ảnh OCR hoặc Dán Chữ/Bảng
        document.querySelectorAll('.tab-source-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-source-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const targetTab = btn.getAttribute('data-tab');

                document.getElementById('excelTabContent').style.display = targetTab === 'excel' ? 'block' : 'none';
                document.getElementById('imageTabContent').style.display = targetTab === 'image' ? 'block' : 'none';
                document.getElementById('pasteTabContent').style.display = targetTab === 'paste' ? 'block' : 'none';
            });
        });

        // Xử lý nút dán bảng giá từ Google Lens / Zalo / Excel
        document.getElementById('btnParsePastedText')?.addEventListener('click', () => {
            const textarea = document.getElementById('pasteTextarea');
            const text = textarea?.value?.trim();
            if (!text) {
                alert('Vui lòng dán văn bản hoặc bảng giá vào ô trước khi trích xuất!');
                return;
            }

            const products = OCRParser.parseSmartText(text);
            if (!products || products.length === 0) {
                alert('Không trích xuất được sản phẩm nào từ nội dung đã dán. Vui lòng kiểm tra lại văn bản.');
                return;
            }

            this.products = products;
            this.currentProductIndex = 0;
            this.updateRegionList();
            this.renderTable();
            this.updatePreview();
            alert(`Trích xuất thành công ${products.length} sản phẩm từ nội dung đã dán!`);
        });

        // Chọn Mẫu Tem (TV & Tủ Lạnh A5 vs Gia Dụng A6)
        document.querySelectorAll('button[data-template]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('button[data-template]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.templateType = btn.getAttribute('data-template');
                this.currentProductIndex = 0;
                this.updatePreview();
                this.renderTable();
            });
        });

        // Chọn Bố Cục Hiển Thị & In (1 tem/trang vs Ghép tem A4)
        document.getElementById('layoutModeSelect')?.addEventListener('change', (e) => {
            this.layoutMode = e.target.value;
            this.updatePreview();
            this.renderTable();
        });

        // Nạp ảnh bảng giá OCR
        const imageFileInput = document.getElementById('imageFileInput');
        if (imageFileInput) {
            imageFileInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (file) await this.handleImageUpload(file);
            });
        }

        // Nút nạp nhanh bảng giá từ ảnh chụp HCM
        document.getElementById('btnLoadDefaultImage')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.products = [...DEFAULT_PRODUCTS];
            this.currentProductIndex = 0;
            this.updateRegionList();
            this.renderTable();
            this.updatePreview();
            alert('Đã nạp đầy đủ 27 sản phẩm chính xác từ ảnh chụp "HCM - Giờ Vàng Giá Sốc"!');
        });

        // Tải file Excel qua Input
        const excelFileInput = document.getElementById('excelFileInput');
        if (excelFileInput) {
            excelFileInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (file) await this.handleExcelUpload(file);
            });
        }

        // Kéo thả file Excel
        const dropzone = document.getElementById('uploadDropzone');
        if (dropzone) {
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', async (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                const file = e.dataTransfer.files?.[0];
                if (file) await this.handleExcelUpload(file);
            });
        }

        // Nút tải file Excel mẫu
        document.getElementById('btnDownloadSample')?.addEventListener('click', (e) => {
            e.preventDefault();
            ExcelParser.exportSampleExcel();
        });

        // Tìm kiếm sản phẩm Model / Tên
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.searchKeyword = e.target.value.trim();
            this.currentProductIndex = 0;
            this.renderTable();
            this.updatePreview();
        });

        // Nhập chữ tiêu đề tùy chỉnh (chữ to, hấp dẫn)
        const customTitleInput = document.getElementById('customTitleInput');
        if (customTitleInput) {
            customTitleInput.addEventListener('input', (e) => {
                this.customTitleText = e.target.value.trim() || 'GIÁ RẺ QUÁ';
                this.updatePreview();
            });
        }

        // Presets tiêu đề
        document.querySelectorAll('.preset-chip[data-text]').forEach(chip => {
            chip.addEventListener('click', () => {
                const text = chip.getAttribute('data-text');
                if (text && customTitleInput) {
                    customTitleInput.value = text;
                    this.customTitleText = text;
                    this.updatePreview();
                }
            });
        });

        // Chọn theme banner in trắng đen
        document.getElementById('bannerThemeSelect')?.addEventListener('change', (e) => {
            this.bannerTheme = e.target.value;
            this.bannerMode = 'svg';
            this.updatePreview();
        });

        // Upload banner tùy chỉnh từ máy tính
        document.getElementById('bannerUploadInput')?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    this.uploadedBannerUrl = evt.target.result;
                    this.bannerMode = 'upload';
                    this.updatePreview();
                };
                reader.readAsDataURL(file);
            }
        });

        // Dòng phụ ưu đãi
        document.getElementById('sublineInput')?.addEventListener('input', (e) => {
            this.customSubline = e.target.value;
            this.updatePreview();
        });

        // Nhập Ngày áp dụng (Ví dụ: ÁP DỤNG 9/10 - 11/10)
        const customDateInput = document.getElementById('customDateInput');
        if (customDateInput) {
            customDateInput.addEventListener('input', (e) => {
                this.customDateText = e.target.value.trim();
                this.updatePreview();
            });
        }

        // Presets ngày áp dụng
        document.querySelectorAll('.preset-chip[data-date]').forEach(chip => {
            chip.addEventListener('click', () => {
                const dateVal = chip.getAttribute('data-date');
                if (dateVal && customDateInput) {
                    customDateInput.value = dateVal;
                    this.customDateText = dateVal;
                    this.updatePreview();
                }
            });
        });

        // Nút chuyển sản phẩm / trang xem trước
        document.getElementById('prevBtn')?.addEventListener('click', () => {
            const filtered = this.getFilteredProducts();
            if (filtered.length <= 1) return;
            if (this.layoutMode === 'single') {
                this.currentProductIndex = (this.currentProductIndex - 1 + filtered.length) % filtered.length;
            } else {
                const itemsPerSheet = this.templateType === 'tvtl_a5' ? 2 : 4;
                const totalSheets = Math.ceil(filtered.length / itemsPerSheet);
                const currentSheet = Math.floor(this.currentProductIndex / itemsPerSheet);
                const prevSheet = (currentSheet - 1 + totalSheets) % totalSheets;
                this.currentProductIndex = prevSheet * itemsPerSheet;
            }
            this.updatePreview();
            this.renderTable();
        });

        document.getElementById('nextBtn')?.addEventListener('click', () => {
            const filtered = this.getFilteredProducts();
            if (filtered.length <= 1) return;
            if (this.layoutMode === 'single') {
                this.currentProductIndex = (this.currentProductIndex + 1) % filtered.length;
            } else {
                const itemsPerSheet = this.templateType === 'tvtl_a5' ? 2 : 4;
                const totalSheets = Math.ceil(filtered.length / itemsPerSheet);
                const currentSheet = Math.floor(this.currentProductIndex / itemsPerSheet);
                const nextSheet = (currentSheet + 1) % totalSheets;
                this.currentProductIndex = nextSheet * itemsPerSheet;
            }
            this.updatePreview();
            this.renderTable();
        });

        // Checkbox chọn tất cả
        document.getElementById('selectAllCb')?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            const filtered = this.getFilteredProducts();
            filtered.forEach(p => p.selected = checked);
            this.renderTable();
        });

        // Nút In
        document.getElementById('btnPrintAll')?.addEventListener('click', () => this.printAllSelected());
        document.getElementById('btnPrintSingle')?.addEventListener('click', () => this.printCurrentSingle());
        document.getElementById('btnHeaderPrint')?.addEventListener('click', () => this.printAllSelected());

        // Phím tắt Ctrl + P
        window.addEventListener('beforeprint', () => {
            const printContainer = document.getElementById('printContainer');
            if (printContainer && printContainer.children.length === 0) {
                const filtered = this.getFilteredProducts();
                const selected = filtered.filter(p => p.selected);
                this.preparePrintSheets(selected.length > 0 ? selected : [filtered[this.currentProductIndex] || filtered[0]]);
            }
        });

        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                this.printAllSelected();
            }
        });

        // Modal hướng dẫn in
        const btnGuide = document.getElementById('btnGuide');
        const guideModal = document.getElementById('guideModal');
        const btnCloseGuide = document.getElementById('btnCloseGuide');

        if (btnGuide && guideModal) {
            btnGuide.addEventListener('click', () => guideModal.style.display = 'flex');
        }
        if (btnCloseGuide && guideModal) {
            btnCloseGuide.addEventListener('click', () => guideModal.style.display = 'none');
        }
        if (guideModal) {
            guideModal.addEventListener('click', (e) => {
                if (e.target === guideModal) guideModal.style.display = 'none';
            });
        }
    }

    // Xử lý nạp hình ảnh qua OCR
    async handleImageUpload(file) {
        const ocrStatusEl = document.getElementById('ocrStatusLabel');
        try {
            if (ocrStatusEl) ocrStatusEl.textContent = 'Đang phân tích hình ảnh...';

            const products = await OCRParser.recognizeImage(file, (pct, statusText) => {
                if (ocrStatusEl) ocrStatusEl.textContent = `${statusText}`;
            });

            if (!products || products.length === 0) {
                alert('Không trích xuất được bảng giá từ ảnh này. Bạn có thể dùng tab [📋 Dán Bảng] để dán chữ từ Google Lens / Zalo.');
                if (ocrStatusEl) ocrStatusEl.textContent = 'Không tìm thấy bảng giá trong ảnh';
                return;
            }

            this.products = products;
            this.currentProductIndex = 0;
            this.updateRegionList();
            this.renderTable();
            this.updatePreview();

            if (ocrStatusEl) ocrStatusEl.textContent = `✅ Đã trích xuất ${products.length} sản phẩm từ ảnh!`;
            alert(`Nhận diện thành công ${products.length} sản phẩm từ hình ảnh!`);
        } catch (err) {
            console.error(err);
            if (ocrStatusEl) ocrStatusEl.textContent = 'Lỗi nhận diện ảnh';
            alert(`Lỗi nhận diện ảnh: ${err.message || 'Ảnh không hỗ trợ'}`);
        }
    }

    // Xử lý nạp file Excel từ máy tính
    async handleExcelUpload(file) {
        const fileStatusBox = document.getElementById('fileStatusBox');
        const fileNameLabel = document.getElementById('fileNameLabel');

        try {
            if (fileStatusBox) fileStatusBox.style.display = 'flex';
            if (fileNameLabel) fileNameLabel.textContent = `Đang đọc: ${file.name}...`;

            const result = await ExcelParser.parseFile(file);

            if (!result.products || result.products.length === 0) {
                alert('Không trích xuất được sản phẩm nào từ file Excel này. Vui lòng kiểm tra lại cấu trúc.');
                return;
            }

            this.products = result.products;
            this.currentProductIndex = 0;

            if (fileNameLabel) {
                fileNameLabel.innerHTML = `<strong>${file.name}</strong> (${this.products.length} sản phẩm)`;
            }

            this.updateRegionList();
            this.renderTable();
            this.updatePreview();

            alert(`Nạp thành công ${this.products.length} sản phẩm từ file Excel!`);
        } catch (err) {
            console.error(err);
            alert(`Lỗi đọc file: ${err.message || 'File không hợp lệ'}`);
            if (fileNameLabel) fileNameLabel.textContent = 'Lỗi nạp file';
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
