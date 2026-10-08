/**
 * Hệ thống in tem giá POPUP Siêu thị (TV & Tủ Lạnh A5 + Gia Dụng A6)
 * Tự động đồng bộ từ Excel / Ảnh chụp OCR - Tối ưu 100% In Trắng Đen
 * MỖI TEM LÀ 1 SẢN PHẨM RIÊNG BIỆT - TUYỆT ĐỐI KHÔNG BỊ TRÙNG LẶP SẢN PHẨM
 */

class App {
    constructor() {
        this.products = [...DEFAULT_PRODUCTS];
        this.currentRegion = 'Vùng Hồ Chí Minh';
        
        // 4 Form Ngành Hàng Chuẩn (CE):
        // 'tvtl': Tivi - Tủ Lạnh (Giấy A4 | Popup: A5x2 | Gạch giá tvtl)
        // 'maygiat': Máy Giặt - Tủ Đông (Giấy A5 | Popup: A6x2 | Gạch giá mg)
        // 'giadung': Gia Dụng (Giấy A5 | Popup: A7x4 | Gạch giá gd)
        // 'maylocnuoc': Máy Lọc Nước (Giấy A5 | Popup: A6x2 | Gạch giá mg)
        this.currentForm = 'tvtl';
        this.selectedCategory = 'all'; // 'all' hoặc 'tv_tl_loa', 'maygiat_tudong', 'giadung', 'maylocnuoc'
        this.searchKeyword = '';
        this.currentProductIndex = 0; // Vị trí sản phẩm xem trước hiện tại

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
        if (typeof window !== 'undefined' && window.location) {
            const urlParams = new URLSearchParams(window.location.search);
            const formParam = urlParams.get('form');
            if (formParam && ['tvtl', 'maygiat', 'giadung', 'maylocnuoc'].includes(formParam)) {
                this.currentForm = formParam;
                this.selectedCategory = this.getFormConfig(formParam).category;
            }
        }
        this.bindEvents();
        this.syncActiveFormAndCategory();
        this.renderTable();
        this.updatePreview();
    }

    syncActiveFormAndCategory() {
        document.querySelectorAll('button[data-form]').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-form') === this.currentForm);
        });
        document.querySelectorAll('.btn-cat-filter').forEach(cb => {
            cb.classList.toggle('active', cb.getAttribute('data-cat') === this.selectedCategory);
        });
    }

    // Cấu hình chuẩn 4 Form CE theo yêu cầu người dùng - TOÀN BỘ LÀ GIẤY ĐỨNG (PORTRAIT)
    getFormConfig(formKey = this.currentForm) {
        switch (formKey) {
            case 'maygiat':
                return {
                    key: 'maygiat',
                    name: 'MÁY GIẶT - TỦ ĐÔNG',
                    paper: 'A5',
                    orientation: 'portrait',
                    pageSize: '148mm 210mm',
                    itemsPerSheet: 2,
                    sheetClass: 'size-a5 layout-mg-a5',
                    renderType: 'mg',
                    category: 'maygiat_tudong',
                    desc: 'GIẤY A5 ĐỨNG | POPUP: A6×2 | GẠCH GIÁ MÁY GIẶT',
                    sourceUrl: 'https://mientay2.pro/in-online/popup/mg/gach/'
                };
            case 'giadung':
                return {
                    key: 'giadung',
                    name: 'GIA DỤNG',
                    paper: 'A5',
                    orientation: 'portrait',
                    pageSize: '148mm 210mm',
                    itemsPerSheet: 4,
                    sheetClass: 'size-a5 layout-gd-a5',
                    renderType: 'gd',
                    category: 'giadung',
                    desc: 'GIẤY A5 ĐỨNG | POPUP: A7×4 | GẠCH GIÁ GIA DỤNG',
                    sourceUrl: 'https://mientay2.pro/in-online/popup/gd/gach/'
                };
            case 'maylocnuoc':
                return {
                    key: 'maylocnuoc',
                    name: 'MÁY LỌC NƯỚC',
                    paper: 'A5',
                    orientation: 'portrait',
                    pageSize: '148mm 210mm',
                    itemsPerSheet: 2,
                    sheetClass: 'size-a5 layout-mg-a5',
                    renderType: 'mg',
                    category: 'maylocnuoc',
                    desc: 'GIẤY A5 ĐỨNG | POPUP: A6×2 | GẠCH GIÁ MÁY GIẶT',
                    sourceUrl: 'https://mientay2.pro/in-online/popup/mg/gach/'
                };
            case 'tvtl':
            default:
                return {
                    key: 'tvtl',
                    name: 'TIVI - TỦ LẠNH',
                    paper: 'A4',
                    orientation: 'portrait',
                    pageSize: '210mm 297mm',
                    itemsPerSheet: 2,
                    sheetClass: 'size-a4 layout-tvtl-a4',
                    renderType: 'tvtl',
                    category: 'tv_tl_loa',
                    desc: 'GIẤY A4 ĐỨNG | POPUP: A5×2 | GẠCH GIÁ TVTL',
                    sourceUrl: 'https://mientay2.pro/in-online/popup/tvtl/gach/'
                };
        }
    }

    // PHÂN LOẠI 27 SẢN PHẨM THEO ĐÚNG 4 NHÓM NGÀNH HÀNG:
    // 1. Tivi, Tủ Lạnh, Loa (+ Tủ Mát): 13 SP
    // 2. Máy Giặt, Tủ Đông: 6 SP
    // 3. Gia Dụng (Lò vi sóng, Nồi cơm): 4 SP
    // 4. Máy Lọc Nước: 4 SP
    getProductGroup(item) {
        const nhomLower = (item.nhom || '').toLowerCase();
        const tenLower = (item.tenSP || '').toLowerCase();

        // 1. Máy Lọc Nước
        if (nhomLower.includes('máy lọc nước') || nhomLower.includes('lọc nước') ||
            tenLower.includes('máy lọc nước') || tenLower.includes('lọc nước') ||
            tenLower.includes('hydrogen') || tenLower.includes('kg100med') ||
            tenLower.includes('karofi') || tenLower.includes('ultrax') ||
            tenLower.includes('hòa phát hpn') || tenLower.includes('kangaroo kg12')) {
            return 'maylocnuoc';
        }

        // 2. Gia Dụng: Lò vi sóng, Nồi cơm, Bếp, Chảo, Nồi, Bình đun, Quạt...
        if (nhomLower.includes('gia dụng') || nhomLower.includes('gd') ||
            tenLower.includes('lò vi sóng') || tenLower.includes('nồi cơm') ||
            tenLower.includes('nồi') || tenLower.includes('chảo') ||
            tenLower.includes('bếp') || tenLower.includes('bình đun') ||
            tenLower.includes('quạt') || tenLower.includes('máy xay') ||
            tenLower.includes('chiên')) {
            return 'giadung';
        }

        // 3. Máy Giặt, Tủ Đông
        if (nhomLower.includes('máy giặt') || nhomLower.includes('giặt') ||
            nhomLower.includes('tủ đông') || nhomLower.includes('máy sấy') ||
            tenLower.includes('máy giặt') || tenLower.includes('máy sấy') ||
            tenLower.includes('tủ đông')) {
            return 'maygiat_tudong';
        }

        // 4. Tivi, Tủ Lạnh, Loa (+ Tủ Mát)
        return 'tv_tl_loa';
    }

    getItemsPerSheet() {
        return this.getFormConfig().itemsPerSheet;
    }

    // Thiết lập khổ giấy và lề in động chuẩn xác 100% không bị lệch
    applyDynamicPrintStyles() {
        let styleEl = document.getElementById('dynamicPrintPageStyle');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'dynamicPrintPageStyle';
            document.head.appendChild(styleEl);
        }

        const config = this.getFormConfig();
        styleEl.textContent = `
            @page {
                size: ${config.pageSize} !important;
                margin: 0mm !important;
            }
        `;
    }

    updateRegionList() {
        // Tự động nhận diện dữ liệu
    }

    // LỌC SẢN PHẨM: THEO 4 NHÓM NGÀNH HÀNG HOẶC TẤT CẢ
    getFilteredProducts() {
        return this.products.filter(item => {
            const group = this.getProductGroup(item);

            if (this.selectedCategory === 'giadung') {
                if (group !== 'giadung') return false;
            } else if (this.selectedCategory === 'maygiat_tudong') {
                if (group !== 'maygiat_tudong') return false;
            } else if (this.selectedCategory === 'tv_tl_loa') {
                if (group !== 'tv_tl_loa') return false;
            } else if (this.selectedCategory === 'maylocnuoc') {
                if (group !== 'maylocnuoc') return false;
            }

            if (this.searchKeyword) {
                const kw = this.searchKeyword.toLowerCase();
                const matchName = (item.tenSP || '').toLowerCase().includes(kw);
                const matchCode = (item.maSP || '').toLowerCase().includes(kw);
                const matchNhom = (item.nhom || '').toLowerCase().includes(kw);
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

        if (!previewContainer) return;

        if (!filtered || filtered.length === 0) {
            previewContainer.innerHTML = `
                <div style="padding: 60px 20px; text-align: center; color: #64748b;">
                    <p style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">Không có sản phẩm nào phù hợp</p>
                    <p style="font-size: 13px;">Vui lòng chọn danh mục khác hoặc nạp lại dữ liệu.</p>
                </div>
            `;
            if (previewIndexLabel) previewIndexLabel.textContent = '0 / 0';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return;
        }

        const config = this.getFormConfig();
        const bannerContent = this.getBannerContent();
        const itemsPerSheet = config.itemsPerSheet;
        const totalSheets = Math.ceil(filtered.length / itemsPerSheet);

        if (this.currentProductIndex >= filtered.length) {
            this.currentProductIndex = 0;
        } else if (this.currentProductIndex < 0) {
            this.currentProductIndex = Math.max(0, (totalSheets - 1) * itemsPerSheet);
        }

        const sheetIndex = Math.floor(this.currentProductIndex / itemsPerSheet);
        const startIndex = sheetIndex * itemsPerSheet;
        const currentSheetItems = filtered.slice(startIndex, startIndex + itemsPerSheet);

        if (previewIndexLabel) {
            previewIndexLabel.textContent = `Trang ${sheetIndex + 1} / ${totalSheets}`;
        }
        if (prevBtn) prevBtn.disabled = totalSheets <= 1;
        if (nextBtn) nextBtn.disabled = totalSheets <= 1;

        previewContainer.className = `paper-sheet ${config.sheetClass}`;

        let html = '';
        for (let i = 0; i < itemsPerSheet; i++) {
            const it = currentSheetItems[i];
            if (it) {
                html += this.renderSingleLabelHTML(it, bannerContent, this.getDateText(it), config.renderType);
            } else {
                const emptyH = itemsPerSheet === 4 ? '355px' : '505px';
                html += `<div style="height: ${emptyH}; border: 2px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 13px;">(Ô trống)</div>`;
            }
        }
        previewContainer.innerHTML = html;

        if (statusBadge) {
            statusBadge.textContent = `${config.name} • ${config.desc}`;
        }

        this.bindInlineEditEvents(previewContainer);
    }

    // Tạo HTML cho 1 tem nhãn chuẩn theo từng ngành hàng CE
    renderSingleLabelHTML(item, bannerContent, dateText, renderType = 'tvtl') {
        const giaNiemYetStr = ExcelParser.formatPrice(item.giaNiemYet);
        const giaEventStr = ExcelParser.formatPrice(item.giaEvent);
        const subline = this.customSubline || '+ TRẢ GÓP 0%';

        if (renderType === 'gd') {
            // Chuẩn GIA DỤNG (A7 x 4): https://mientay2.pro/in-online/popup/gd/gach/
            return `
                <div class="label-box format-gd-a7" data-item-id="${item.id}">
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
        } else if (renderType === 'mg') {
            // Chuẩn MÁY GIẶT - TỦ ĐÔNG & MÁY LỌC NƯỚC (A6 x 2): https://mientay2.pro/in-online/popup/mg/gach/
            return `
                <div class="label-box format-mg-a6" data-item-id="${item.id}">
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
            // Chuẩn TIVI - TỦ LẠNH (A5 x 2): https://mientay2.pro/in-online/popup/tvtl/gach/
            return `
                <div class="label-box format-tvtl-a5" data-item-id="${item.id}">
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

        if (totalCountEl) {
            totalCountEl.textContent = `${filtered.length} / ${this.products.length} sản phẩm`;
        }
        
        const itemsPerSheet = this.getItemsPerSheet();
        const selectedCount = filtered.filter(p => p.selected).length;
        if (selectedCountEl) {
            const pageEstimate = Math.ceil(selectedCount / itemsPerSheet);
            selectedCountEl.textContent = `Đã chọn: ${selectedCount} sản phẩm (~ ${pageEstimate} tờ in)`;
        }

        if (!tableBody) return;

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:#94a3b8;">Không có sản phẩm nào phù hợp bộ lọc.</td></tr>`;
            return;
        }

        tableBody.innerHTML = filtered.map((item, idx) => {
            const isCurrent = itemsPerSheet === 1
                ? idx === this.currentProductIndex
                : Math.floor(idx / itemsPerSheet) === Math.floor(this.currentProductIndex / itemsPerSheet);
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

        this.applyDynamicPrintStyles();
        printContainer.innerHTML = '';
        const bannerContent = this.getBannerContent();
        const config = this.getFormConfig();
        const itemsPerSheet = config.itemsPerSheet;

        for (let i = 0; i < targetItems.length; i += itemsPerSheet) {
            const sheet = document.createElement('div');
            sheet.className = `print-sheet ${config.sheetClass}`;

            let html = '';
            for (let j = 0; j < itemsPerSheet; j++) {
                const it = targetItems[i + j];
                if (it) {
                    html += this.renderSingleLabelHTML(it, bannerContent, this.getDateText(it), config.renderType);
                }
            }
            sheet.innerHTML = html;
            printContainer.appendChild(sheet);
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

    // In tờ hiện tại đang xem (1 trang chuẩn theo Form đã chọn)
    printCurrentSingle() {
        const filtered = this.getFilteredProducts();
        if (filtered.length === 0) return;

        const printContainer = document.getElementById('printContainer');
        if (!printContainer) return;

        this.applyDynamicPrintStyles();
        printContainer.innerHTML = '';
        const bannerContent = this.getBannerContent();
        const config = this.getFormConfig();
        const itemsPerSheet = config.itemsPerSheet;

        const sheetIndex = Math.floor(this.currentProductIndex / itemsPerSheet);
        const startIndex = sheetIndex * itemsPerSheet;
        const currentSheetItems = filtered.slice(startIndex, startIndex + itemsPerSheet);

        const sheet = document.createElement('div');
        sheet.className = `print-sheet ${config.sheetClass}`;

        let html = '';
        for (let j = 0; j < itemsPerSheet; j++) {
            const it = currentSheetItems[j];
            if (it) {
                html += this.renderSingleLabelHTML(it, bannerContent, this.getDateText(it), config.renderType);
            }
        }
        sheet.innerHTML = html;
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

        // Chọn Mẫu POPUP Ngành Hàng (CE) - 4 Form Chuẩn:
        // 1. tvtl: TIVI - TỦ LẠNH (Giấy A4 | POPUP: A5×2 | GẠCH GIÁ TVTL)
        // 2. maygiat: MÁY GIẶT - TỦ ĐÔNG (Giấy A5 | POPUP: A6×2 | GẠCH GIÁ MÁY GIẶT)
        // 3. giadung: GIA DỤNG (Giấy A5 | POPUP: A7×4 | GẠCH GIÁ GIA DỤNG)
        // 4. maylocnuoc: MÁY LỌC NƯỚC (Giấy A5 | POPUP: A6×2 | GẠCH GIÁ MÁY GIẶT)
        document.querySelectorAll('button[data-form]').forEach(btn => {
            btn.addEventListener('click', () => {
                const formKey = btn.getAttribute('data-form');
                this.currentForm = formKey;
                const config = this.getFormConfig(formKey);

                // Đồng bộ lọc danh mục tương ứng
                this.selectedCategory = config.category;
                this.syncActiveFormAndCategory();

                this.currentProductIndex = 0;
                this.updatePreview();
                this.renderTable();
            });
        });

        // Bộ lọc ưu tiên danh mục 4 nhóm chuẩn (Tất cả, TV/TL, Giặt/Đông, Gia Dụng, Lọc Nước)
        document.querySelectorAll('.btn-cat-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.getAttribute('data-cat') || 'all';
                this.selectedCategory = cat;

                // Đồng bộ form tương ứng nếu bấm chọn nhóm ngành hàng cụ thể
                if (cat === 'tv_tl_loa') this.currentForm = 'tvtl';
                else if (cat === 'maygiat_tudong') this.currentForm = 'maygiat';
                else if (cat === 'giadung') this.currentForm = 'giadung';
                else if (cat === 'maylocnuoc') this.currentForm = 'maylocnuoc';

                this.syncActiveFormAndCategory();
                this.currentProductIndex = 0;
                this.renderTable();
                this.updatePreview();
            });
        });

        // Nút ưu tiên chọn nhanh sản phẩm theo đúng 4 nhóm ngành hàng CE
        document.getElementById('btnSelectTvTlLoa')?.addEventListener('click', () => {
            this.currentForm = 'tvtl';
            this.selectedCategory = 'tv_tl_loa';
            this.syncActiveFormAndCategory();
            this.products.forEach(p => {
                p.selected = this.getProductGroup(p) === 'tv_tl_loa';
            });
            this.renderTable();
            this.updatePreview();
        });

        document.getElementById('btnSelectMayGiatTuDong')?.addEventListener('click', () => {
            this.currentForm = 'maygiat';
            this.selectedCategory = 'maygiat_tudong';
            this.syncActiveFormAndCategory();
            this.products.forEach(p => {
                p.selected = this.getProductGroup(p) === 'maygiat_tudong';
            });
            this.renderTable();
            this.updatePreview();
        });

        document.getElementById('btnSelectGiaDung')?.addEventListener('click', () => {
            this.currentForm = 'giadung';
            this.selectedCategory = 'giadung';
            this.syncActiveFormAndCategory();
            this.products.forEach(p => {
                p.selected = this.getProductGroup(p) === 'giadung';
            });
            this.renderTable();
            this.updatePreview();
        });

        document.getElementById('btnSelectMayLocNuoc')?.addEventListener('click', () => {
            this.currentForm = 'maylocnuoc';
            this.selectedCategory = 'maylocnuoc';
            this.syncActiveFormAndCategory();
            this.products.forEach(p => {
                p.selected = this.getProductGroup(p) === 'maylocnuoc';
            });
            this.renderTable();
            this.updatePreview();
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
            const itemsPerSheet = this.getItemsPerSheet();
            if (itemsPerSheet === 1) {
                this.currentProductIndex = (this.currentProductIndex - 1 + filtered.length) % filtered.length;
            } else {
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
            const itemsPerSheet = this.getItemsPerSheet();
            if (itemsPerSheet === 1) {
                this.currentProductIndex = (this.currentProductIndex + 1) % filtered.length;
            } else {
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
