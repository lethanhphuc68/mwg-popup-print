/**
 * Hệ thống in tem giá POPUP Siêu thị (TV & Tủ Lạnh A5 + Gia Dụng A6)
 * Tự động đồng bộ từ Excel / Ảnh chụp OCR - Tối ưu 100% In Trắng Đen
 */

class App {
    constructor() {
        this.products = [...DEFAULT_PRODUCTS];
        this.currentRegion = 'Vùng Hồ Chí Minh';
        this.selectedGroup = 'all';
        this.searchKeyword = '';
        this.currentPreviewIndex = 0;

        // Chọn mẫu tem: 'tvtl_a5' (TV & Tủ Lạnh A5 - 2 tem/A4) hoặc 'giadung_a6' (Gia Dụng A6 - 4 tem/A4)
        this.templateType = 'tvtl_a5';

        // Tùy chọn in
        this.duplicateSingle = true; // Nhân đôi để lấp đầy tờ A4
        this.bannerMode = 'svg';
        this.customTitleText = 'GIÁ RẺ QUÁ';
        this.bannerTheme = 'bw_classic';
        this.customSubline = '+ TRẢ GÓP 0%';
        this.uploadedBannerUrl = null;
        this.dateMode = 'today';
        this.customDateText = '';

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateRegionList();
        this.renderTable();
        this.updatePreview();
    }

    getFormattedToday() {
        const d = new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `NGÀY IN: ${day}/${month}/${year}`;
    }

    getFilteredProducts() {
        return this.products.filter(item => {
            if (this.currentRegion && this.currentRegion !== 'all') {
                const itemRegion = (item.vung || '').toLowerCase();
                const targetRegion = this.currentRegion.toLowerCase();
                if (!itemRegion.includes(targetRegion) && !targetRegion.includes(itemRegion)) {
                    return false;
                }
            }

            if (this.selectedGroup !== 'all' && item.nhom !== this.selectedGroup) {
                return false;
            }

            if (this.searchKeyword) {
                const kw = this.searchKeyword.toLowerCase();
                const matchName = (item.tenSP || '').toLowerCase().includes(kw);
                const matchCode = (item.maSP || '').toLowerCase().includes(kw);
                if (!matchName && !matchCode) return false;
            }

            return true;
        });
    }

    updateRegionList() {
        const regionSelect = document.getElementById('regionSelect');
        const groupSelect = document.getElementById('groupSelect');
        if (!regionSelect) return;

        const regions = Array.from(new Set(this.products.map(p => p.vung).filter(Boolean)));
        regionSelect.innerHTML = '<option value="all">-- Tất cả các vùng --</option>';
        regions.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            regionSelect.appendChild(opt);
        });

        const hcmRegion = regions.find(r => r.toLowerCase().includes('hồ chí minh') || r.toLowerCase().includes('ho chi minh'));
        if (hcmRegion) {
            this.currentRegion = hcmRegion;
            regionSelect.value = hcmRegion;
        } else if (regions.length > 0) {
            this.currentRegion = regions[0];
            regionSelect.value = regions[0];
        }

        const groups = Array.from(new Set(this.products.map(p => p.nhom).filter(Boolean)));
        groupSelect.innerHTML = '<option value="all">-- Tất cả nhóm hàng --</option>';
        groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            groupSelect.appendChild(opt);
        });
    }

    getBannerContent() {
        if (this.bannerMode === 'upload' && this.uploadedBannerUrl) {
            return `<img src="${this.uploadedBannerUrl}" style="width:100%; height:100%; object-fit:contain;" alt="Banner" />`;
        }
        return BannerGenerator.getBannerSVG(this.customTitleText, this.bannerTheme);
    }

    getDateText(item) {
        if (this.dateMode === 'today') {
            return this.getFormattedToday();
        } else if (this.dateMode === 'event_slot' && item.khungGio) {
            return item.khungGio.toUpperCase();
        } else if (this.dateMode === 'custom' && this.customDateText) {
            return this.customDateText.toUpperCase();
        }
        return this.getFormattedToday();
    }

    // Hiển thị xem trước tem in trên màn hình (Live Preview)
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

        if (this.currentPreviewIndex >= filtered.length) {
            this.currentPreviewIndex = 0;
        } else if (this.currentPreviewIndex < 0) {
            this.currentPreviewIndex = filtered.length - 1;
        }

        const currentItem = filtered[this.currentPreviewIndex];
        if (previewIndexLabel) {
            previewIndexLabel.textContent = `${this.currentPreviewIndex + 1} / ${filtered.length}`;
        }
        if (prevBtn) prevBtn.disabled = filtered.length <= 1;
        if (nextBtn) nextBtn.disabled = filtered.length <= 1;

        const bannerContent = this.getBannerContent();
        previewContainer.className = 'paper-sheet size-a4';

        if (this.templateType === 'tvtl_a5') {
            // MẪU TV & TỦ LẠNH (A5 - 2 TEM / TỜ A4)
            previewContainer.classList.add('template-tvtl');

            let secondItem = currentItem;
            if (!this.duplicateSingle && filtered.length > 1) {
                secondItem = filtered[(this.currentPreviewIndex + 1) % filtered.length];
            }

            previewContainer.innerHTML = `
                ${this.renderSingleLabelHTML(currentItem, bannerContent, this.getDateText(currentItem), 'tvtl_a5')}
                ${this.renderSingleLabelHTML(secondItem, bannerContent, this.getDateText(secondItem), 'tvtl_a5')}
            `;

            if (statusBadge) {
                statusBadge.textContent = this.duplicateSingle
                    ? `A5 TV & TL (2 tem SP #${this.currentPreviewIndex + 1})`
                    : `A5 TV & TL (SP #${this.currentPreviewIndex + 1} & #${((this.currentPreviewIndex + 1) % filtered.length) + 1})`;
            }
        } else {
            // MẪU GIA DỤNG (A6 - 4 TEM / TỜ A4)
            previewContainer.classList.add('template-giadung');

            let items4 = [];
            if (this.duplicateSingle || filtered.length === 1) {
                items4 = [currentItem, currentItem, currentItem, currentItem];
            } else {
                items4 = [
                    currentItem,
                    filtered[(this.currentPreviewIndex + 1) % filtered.length],
                    filtered[(this.currentPreviewIndex + 2) % filtered.length],
                    filtered[(this.currentPreviewIndex + 3) % filtered.length]
                ];
            }

            previewContainer.innerHTML = items4.map(it => 
                this.renderSingleLabelHTML(it, bannerContent, this.getDateText(it), 'giadung_a6')
            ).join('');

            if (statusBadge) {
                statusBadge.textContent = this.duplicateSingle
                    ? `A6 Gia Dụng (4 tem SP #${this.currentPreviewIndex + 1})`
                    : `A6 Gia Dụng (4 tem từ SP #${this.currentPreviewIndex + 1})`;
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
            // Mẫu TV & Tủ Lạnh A5 (chuẩn mientay2.pro/in-online/popup/tvtl/gach-a5/)
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
                        <input type="text" class="input-print-date editable-field" data-field="dateText" value="${dateText}" title="Nhấp để sửa ngày in" />
                    </div>
                </div>
            `;
        } else {
            // Mẫu Gia Dụng A6 (chuẩn mientay2.pro/in-online/popup/gd/gach/)
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
                    <input type="text" class="gd-pdat editable-field" data-field="dateText" value="${dateText}" title="Nhấp để sửa ngày in" />
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
            const itemsPerPage = this.templateType === 'tvtl_a5' ? 2 : 4;
            const pageEstimate = Math.ceil(selectedCount / itemsPerPage);
            selectedCountEl.textContent = `Đã chọn: ${selectedCount} sản phẩm (~ ${pageEstimate} tờ A4 in ra ${selectedCount * (this.duplicateSingle && selectedCount === 1 ? itemsPerPage : 1)} tem)`;
        }

        if (!tableBody) return;

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:#94a3b8;">Không có sản phẩm nào phù hợp bộ lọc.</td></tr>`;
            return;
        }

        tableBody.innerHTML = filtered.map((item, idx) => {
            const isCurrentPreview = idx === this.currentPreviewIndex;
            const diff = item.giaNiemYet - item.giaEvent;
            const percent = item.giaNiemYet > 0 ? Math.round((diff / item.giaNiemYet) * 100) : 0;

            return `
                <tr class="${isCurrentPreview ? 'active-row' : ''}">
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
                this.currentPreviewIndex = idx;
                this.updatePreview();
                this.renderTable();
                document.getElementById('previewPaperSheet')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        });
    }

    // Chuẩn bị toàn bộ các trang in cho lệnh in (A4 2 tem hoặc 4 tem)
    preparePrintSheets(targetItems) {
        const printContainer = document.getElementById('printContainer');
        if (!printContainer) return;

        printContainer.innerHTML = '';
        const bannerContent = this.getBannerContent();

        if (this.templateType === 'tvtl_a5') {
            // MẪU TV & TỦ LẠNH (A5 - 2 TEM / TỜ A4)
            if (targetItems.length === 1 && this.duplicateSingle) {
                const sheet = document.createElement('div');
                sheet.className = 'print-sheet size-a4 template-tvtl';
                const item = targetItems[0];
                const dateText = this.getDateText(item);
                sheet.innerHTML = `
                    ${this.renderSingleLabelHTML(item, bannerContent, dateText, 'tvtl_a5')}
                    ${this.renderSingleLabelHTML(item, bannerContent, dateText, 'tvtl_a5')}
                `;
                printContainer.appendChild(sheet);
                return;
            }

            for (let i = 0; i < targetItems.length; i += 2) {
                const sheet = document.createElement('div');
                sheet.className = 'print-sheet size-a4 template-tvtl';
                const item1 = targetItems[i];
                let item2 = targetItems[i + 1];
                if (!item2 && this.duplicateSingle) item2 = item1;

                sheet.innerHTML = `
                    ${this.renderSingleLabelHTML(item1, bannerContent, this.getDateText(item1), 'tvtl_a5')}
                    ${item2 ? this.renderSingleLabelHTML(item2, bannerContent, this.getDateText(item2), 'tvtl_a5') : ''}
                `;
                printContainer.appendChild(sheet);
            }
        } else {
            // MẪU GIA DỤNG (A6 - 4 TEM / TỜ A4)
            if (targetItems.length === 1 && this.duplicateSingle) {
                const sheet = document.createElement('div');
                sheet.className = 'print-sheet size-a4 template-giadung';
                const item = targetItems[0];
                const dateText = this.getDateText(item);
                sheet.innerHTML = `
                    ${this.renderSingleLabelHTML(item, bannerContent, dateText, 'giadung_a6')}
                    ${this.renderSingleLabelHTML(item, bannerContent, dateText, 'giadung_a6')}
                    ${this.renderSingleLabelHTML(item, bannerContent, dateText, 'giadung_a6')}
                    ${this.renderSingleLabelHTML(item, bannerContent, dateText, 'giadung_a6')}
                `;
                printContainer.appendChild(sheet);
                return;
            }

            for (let i = 0; i < targetItems.length; i += 4) {
                const sheet = document.createElement('div');
                sheet.className = 'print-sheet size-a4 template-giadung';
                let html = '';
                for (let j = 0; j < 4; j++) {
                    let it = targetItems[i + j];
                    if (!it && this.duplicateSingle && targetItems[i]) it = targetItems[i];
                    if (it) {
                        html += this.renderSingleLabelHTML(it, bannerContent, this.getDateText(it), 'giadung_a6');
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

    printCurrentSingle() {
        const filtered = this.getFilteredProducts();
        if (filtered.length === 0) return;

        const currentItem = filtered[this.currentPreviewIndex];
        this.preparePrintSheets([currentItem]);
        window.print();
    }

    bindEvents() {
        // Chuyển Tab nguồn nạp: Excel hoặc Hình Ảnh OCR
        document.querySelectorAll('.tab-source-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-source-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const targetTab = btn.getAttribute('data-tab');

                document.getElementById('excelTabContent').style.display = targetTab === 'excel' ? 'block' : 'none';
                document.getElementById('imageTabContent').style.display = targetTab === 'image' ? 'block' : 'none';
            });
        });

        // Chọn Mẫu Tem (TV & Tủ Lạnh A5 vs Gia Dụng A6)
        document.querySelectorAll('button[data-template]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('button[data-template]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.templateType = btn.getAttribute('data-template');
                this.updatePreview();
                this.renderTable();
            });
        });

        // Nạp ảnh bảng giá OCR
        const imageFileInput = document.getElementById('imageFileInput');
        if (imageFileInput) {
            imageFileInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (file) await this.handleImageUpload(file);
            });
        }

        // Nút nạp nhanh bảng giá từ ảnh chụp gửi trong chat
        document.getElementById('btnLoadDefaultImage')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.products = [...DEFAULT_PRODUCTS];
            this.currentPreviewIndex = 0;
            this.updateRegionList();
            this.renderTable();
            this.updatePreview();
            alert('Đã nạp 27 sản phẩm từ ảnh chụp "HCM - Giờ Vàng Giá Sốc"!');
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

        // Chọn Vùng
        document.getElementById('regionSelect')?.addEventListener('change', (e) => {
            this.currentRegion = e.target.value;
            this.currentPreviewIndex = 0;
            this.renderTable();
            this.updatePreview();
        });

        // Chọn Nhóm
        document.getElementById('groupSelect')?.addEventListener('change', (e) => {
            this.selectedGroup = e.target.value;
            this.currentPreviewIndex = 0;
            this.renderTable();
            this.updatePreview();
        });

        // Tìm kiếm sản phẩm
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.searchKeyword = e.target.value.trim();
            this.currentPreviewIndex = 0;
            this.renderTable();
            this.updatePreview();
        });

        // Checkbox tự động nhân đôi tem khi in A4
        document.getElementById('duplicateSingleCb')?.addEventListener('change', (e) => {
            this.duplicateSingle = e.target.checked;
            this.updatePreview();
            this.renderTable();
        });

        // Nhập chữ tiêu đề tùy chỉnh
        const customTitleInput = document.getElementById('customTitleInput');
        if (customTitleInput) {
            customTitleInput.addEventListener('input', (e) => {
                this.customTitleText = e.target.value.trim() || 'GIÁ RẺ QUÁ';
                this.updatePreview();
            });
        }

        // Presets tiêu đề
        document.querySelectorAll('.preset-chip').forEach(chip => {
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

        // Dòng phụ
        document.getElementById('sublineInput')?.addEventListener('input', (e) => {
            this.customSubline = e.target.value;
            this.updatePreview();
        });

        // Chọn chế độ ngày in
        const dateModeSelect = document.getElementById('dateModeSelect');
        const customDateInput = document.getElementById('customDateInput');
        if (dateModeSelect) {
            dateModeSelect.addEventListener('change', (e) => {
                this.dateMode = e.target.value;
                if (customDateInput) {
                    customDateInput.style.display = this.dateMode === 'custom' ? 'block' : 'none';
                }
                this.updatePreview();
            });
        }

        if (customDateInput) {
            customDateInput.addEventListener('input', (e) => {
                this.customDateText = e.target.value;
                this.updatePreview();
            });
        }

        // Nút chuyển trang xem trước
        document.getElementById('prevBtn')?.addEventListener('click', () => {
            const filtered = this.getFilteredProducts();
            if (filtered.length <= 1) return;
            this.currentPreviewIndex = (this.currentPreviewIndex - 1 + filtered.length) % filtered.length;
            this.updatePreview();
            this.renderTable();
        });

        document.getElementById('nextBtn')?.addEventListener('click', () => {
            const filtered = this.getFilteredProducts();
            if (filtered.length <= 1) return;
            this.currentPreviewIndex = (this.currentPreviewIndex + 1) % filtered.length;
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
                this.preparePrintSheets(selected.length > 0 ? selected : [filtered[this.currentPreviewIndex]]);
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
                alert('Không trích xuất được bảng giá từ ảnh này. Vui lòng đảm bảo ảnh chụp rõ nét hoặc nạp file Excel.');
                if (ocrStatusEl) ocrStatusEl.textContent = 'Không tìm thấy bảng giá trong ảnh';
                return;
            }

            this.products = products;
            this.currentPreviewIndex = 0;
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
            this.currentPreviewIndex = 0;

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
