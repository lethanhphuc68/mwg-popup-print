/**
 * Xử lý nhập và phân tích file Excel (.xlsx, .xls, .csv)
 */
class ExcelParser {
    static normalizeHeader(text) {
        if (!text) return '';
        return String(text)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
    }

    static parsePrice(val) {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return Math.round(val);
        const str = String(val).trim();
        // Loại bỏ ký tự không phải số (ngoại trừ số)
        const clean = str.replace(/[^\d]/g, '');
        return clean ? parseInt(clean, 10) : 0;
    }

    static formatPrice(num) {
        if (!num || isNaN(num)) return '0';
        return Number(num).toLocaleString('vi-VN').replace(/,/g, '.');
    }

    static async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Lấy sheet đầu tiên hoặc sheet chứa từ 'gia' / 'list' / 'danh sach'
                    let targetSheetName = workbook.SheetNames[0];
                    for (const name of workbook.SheetNames) {
                        const norm = this.normalizeHeader(name);
                        if (norm.includes('gia') || norm.includes('gio vang') || norm.includes('danh sach')) {
                            targetSheetName = name;
                            break;
                        }
                    }

                    const worksheet = workbook.Sheets[targetSheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                    if (!rows || rows.length === 0) {
                        throw new Error('File Excel rỗng, không tìm thấy dữ liệu.');
                    }

                    const parsed = this.extractDataFromRows(rows);
                    resolve(parsed);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Không thể đọc file'));
            reader.readAsArrayBuffer(file);
        });
    }

    static extractDataFromRows(rows) {
        // Tìm dòng tiêu đề cột thích hợp nhất (trong 10 dòng đầu)
        let headerRowIndex = -1;
        let bestScore = 0;
        let columnMapping = null;

        for (let i = 0; i < Math.min(10, rows.length); i++) {
            const row = rows[i];
            if (!Array.isArray(row)) continue;

            const mapping = this.detectColumnIndexes(row);
            let score = 0;
            if (mapping.tenSP !== -1) score += 4;
            if (mapping.giaEvent !== -1) score += 4;
            if (mapping.giaNiemYet !== -1) score += 3;
            if (mapping.vung !== -1) score += 3;
            if (mapping.nhom !== -1) score += 1;
            if (mapping.maSP !== -1) score += 1;

            if (score > bestScore) {
                bestScore = score;
                headerRowIndex = i;
                columnMapping = mapping;
            }
        }

        if (headerRowIndex === -1 || bestScore < 4) {
            // Nếu không tự động khớp được, cố gắng tìm fallback
            throw new Error('Không nhận diện được các cột dữ liệu cần thiết (Model, Giá niêm yết, Giá Event). Vui lòng kiểm tra lại cấu trúc file Excel.');
        }

        const products = [];
        const regionsSet = new Set();
        const groupsSet = new Set();

        for (let r = headerRowIndex + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!Array.isArray(row) || row.length === 0) continue;

            const tenSP = columnMapping.tenSP !== -1 ? String(row[columnMapping.tenSP] || '').trim() : '';
            const giaEventRaw = columnMapping.giaEvent !== -1 ? row[columnMapping.giaEvent] : '';
            const giaNiemYetRaw = columnMapping.giaNiemYet !== -1 ? row[columnMapping.giaNiemYet] : '';

            // Bỏ qua dòng trống tên hoặc không có giá
            if (!tenSP && !giaEventRaw) continue;

            const vung = columnMapping.vung !== -1 ? String(row[columnMapping.vung] || '').trim() : 'Mặc định';
            const nhom = columnMapping.nhom !== -1 ? String(row[columnMapping.nhom] || '').trim() : 'Sản phẩm';
            const maSP = columnMapping.maSP !== -1 ? String(row[columnMapping.maSP] || '').trim() : '';
            const ghiChu = columnMapping.ghiChu !== -1 ? String(row[columnMapping.ghiChu] || '').trim() : '';
            const khungGio = columnMapping.khungGio !== -1 ? String(row[columnMapping.khungGio] || '').trim() : '';

            const giaNiemYet = this.parsePrice(giaNiemYetRaw);
            const giaEvent = this.parsePrice(giaEventRaw);

            if (vung) regionsSet.add(vung);
            if (nhom) groupsSet.add(nhom);

            products.push({
                id: `sp-${r}-${Date.now().toString(36)}`,
                nhom: nhom || 'Khác',
                vung: vung || 'Khác',
                maSP: maSP,
                tenSP: tenSP,
                giaNiemYet: giaNiemYet,
                giaEvent: giaEvent,
                khungGio: khungGio,
                ghiChu: ghiChu,
                selected: true
            });
        }

        return {
            products,
            regions: Array.from(regionsSet).filter(Boolean),
            groups: Array.from(groupsSet).filter(Boolean),
            headerRowIndex,
            columnMapping
        };
    }

    static detectColumnIndexes(headerRow) {
        const mapping = {
            vung: -1,
            nhom: -1,
            maSP: -1,
            tenSP: -1,
            giaNiemYet: -1,
            giaEvent: -1,
            khungGio: -1,
            ghiChu: -1
        };

        headerRow.forEach((cell, idx) => {
            const norm = this.normalizeHeader(cell);
            if (!norm) return;

            // Vùng RSM
            if (mapping.vung === -1 && (norm.includes('vung rsm') || norm.includes('vung') || norm.includes('khu vuc') || norm.includes('rsm'))) {
                mapping.vung = idx;
            }
            // Nhóm
            else if (mapping.nhom === -1 && (norm.includes('nhom') || norm.includes('nganh hang') || norm.includes('loai sp') || norm.includes('category'))) {
                mapping.nhom = idx;
            }
            // Mã sản phẩm
            else if (mapping.maSP === -1 && (norm.includes('ma san pham') || norm.includes('ma sp') || norm.includes('sku') || norm === 'ma')) {
                mapping.maSP = idx;
            }
            // Model Giờ Vàng / Tên sản phẩm
            else if (mapping.tenSP === -1 && (norm.includes('model gio vang') || norm.includes('model') || norm.includes('san pham') || norm.includes('ten sp') || norm.includes('ten hang'))) {
                mapping.tenSP = idx;
            }
            // Giá niêm yết (Gạch)
            else if (mapping.giaNiemYet === -1 && (norm.includes('niem yet') || norm.includes('gia ny') || norm.includes('gia goc') || norm.includes('gia cu') || norm.includes('gach'))) {
                mapping.giaNiemYet = idx;
            }
            // Giá bán Event Giờ Vàng (Khuyến mãi)
            else if (mapping.giaEvent === -1 && (norm.includes('event') || norm.includes('gio vang') || norm.includes('khuyen mai') || norm.includes('gia ban') || norm.includes('gia km') || norm.includes('gia soc'))) {
                mapping.giaEvent = idx;
            }
            // Khung giờ
            else if (mapping.khungGio === -1 && (norm.includes('khung gio') || norm.includes('suat') || norm.includes('gio') || norm.includes('ngay'))) {
                mapping.khungGio = idx;
            }
            // Ghi chú
            else if (mapping.ghiChu === -1 && (norm.includes('ghi chu') || norm.includes('note') || norm.includes('chu thich'))) {
                mapping.ghiChu = idx;
            }
        });

        // Nếu chưa tìm thấy giá niêm yết hoặc giá event nhưng có 2 cột chứa từ "gia"
        if (mapping.giaNiemYet === -1 || mapping.giaEvent === -1) {
            headerRow.forEach((cell, idx) => {
                const norm = this.normalizeHeader(cell);
                if (norm.includes('gia')) {
                    if (mapping.giaNiemYet === -1 && (norm.includes('niem yet') || norm.includes('goc'))) {
                        mapping.giaNiemYet = idx;
                    } else if (mapping.giaEvent === -1 && (norm.includes('ban') || norm.includes('km') || norm.includes('event'))) {
                        mapping.giaEvent = idx;
                    }
                }
            });
        }

        return mapping;
    }

    static exportSampleExcel() {
        const wb = XLSX.utils.book_new();
        
        const wsData = [
            [],
            ['DANH SÁCH SIÊU THỊ ĐĂNG KÝ BÁN GIỜ VÀNG GIÁ SỐC', '', '', '', '', '', 'Ngày 9.10', 'Ngày 10.10', 'Ngày 11.10', 'Ghi chú'],
            [
                'Nhóm',
                'Vùng RSM',
                'Mã sản phẩm',
                'MODEL GIỜ VÀNG GIÁ SỐC',
                'Giá niêm yết',
                'Giá bán Event Giờ Vàng',
                'chia 2 khung giờ 9h - 12h & 14h - 20h',
                'chia 2 khung giờ 9h - 12h & 14h - 20h',
                'chia 2 khung giờ 9h - 12h & 14h - 20h',
                'Ghi chú'
            ],
            ['Loa Karaoke', 'Vùng Hồ Chí Minh', '3040880000094', 'Loa Karaoke Dalton TS-12G450X', 9090000, 6990000, '5 suất / siêu thị', '5 suất / siêu thị', '5 suất / siêu thị', '- Sau 23h ngày 11.10 tất cả PMH hết hiệu lực'],
            ['Loa Karaoke', 'Vùng Hồ Chí Minh', '3040880000234', 'Loa Karaoke Dalton PartyPro 215', 18700000, 13990000, '5 suất / siêu thị', '5 suất / siêu thị', '5 suất / siêu thị', '- Sau 23h ngày 11.10 tất cả PMH hết hiệu lực'],
            ['Tivi Led', 'Vùng Hồ Chí Minh', '3041094002049', 'Tivi LED Sony K-55S25 (BRAVIA 2 II)', 20590000, 13990000, '5 suất / siêu thị', '5 suất / siêu thị', '5 suất / siêu thị', '- Sau 23h ngày 11.10 tất cả PMH hết hiệu lực'],
            ['Tivi Led', 'Vùng Hồ Chí Minh', '3041094001913', 'TCL QD-Mini LED 4K TV 65C6KS', 21990000, 12990000, '5 suất / siêu thị', '5 suất / siêu thị', '5 suất / siêu thị', '- Sau 23h ngày 11.10 tất cả PMH hết hiệu lực'],
            ['Tivi Led', 'Vùng Hồ Chí Minh', '3041094002166', 'Tivi Mini LED Samsung UA65M8XHA', 21900000, 14990000, '5 suất / siêu thị', '5 suất / siêu thị', '5 suất / siêu thị', '- Sau 23h ngày 11.10 tất cả PMH hết hiệu lực'],
            ['Tivi Led', 'Vùng Hồ Chí Minh', '3041094002206', 'TIVI QNED LG 55QNED70BSA', 18900000, 13390000, '5 suất / siêu thị', '5 suất / siêu thị', '5 suất / siêu thị', '- Sau 23h ngày 11.10 tất cả PMH hết hiệu lực'],
            ['Tủ Lạnh', 'Vùng Hồ Chí Minh', '3041120000188', 'Tủ Lạnh Panasonic Inverter 322 Lít NR-BV360QSVN', 14500000, 10890000, '3 suất / siêu thị', '3 suất / siêu thị', '3 suất / siêu thị', 'Số lượng có hạn'],
            ['Máy Giặt', 'Vùng Hồ Chí Minh', '3041150000215', 'Máy Giặt Toshiba Inverter 9.5 Kg TW-BL105A4V(SS)', 9990000, 6890000, '4 suất / siêu thị', '4 suất / siêu thị', '4 suất / siêu thị', 'Số lượng có hạn'],
            ['Tivi Led', 'Vùng Miền Tây', '3041094002049', 'Tivi LED Sony K-55S25 (BRAVIA 2 II)', 20590000, 14290000, '5 suất / siêu thị', '5 suất / siêu thị', '5 suất / siêu thị', 'Áp dụng Miền Tây'],
            ['Tivi Led', 'Vùng Miền Tây', '3041094001913', 'TCL QD-Mini LED 4K TV 65C6KS', 21990000, 13190000, '5 suất / siêu thị', '5 suất / siêu thị', '5 suất / siêu thị', 'Áp dụng Miền Tây']
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Đặt độ rộng cột
        ws['!cols'] = [
            { wch: 15 },
            { wch: 20 },
            { wch: 18 },
            { wch: 38 },
            { wch: 16 },
            { wch: 22 },
            { wch: 22 },
            { wch: 22 },
            { wch: 22 },
            { wch: 35 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'DanhSachGia');
        XLSX.writeFile(wb, 'Mau_Danh_Sach_Gio_Vang_MWG.xlsx');
    }
}
