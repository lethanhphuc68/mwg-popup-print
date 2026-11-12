/**
 * Bộ trích xuất dữ liệu bảng giá thông minh từ hình ảnh (Image Enhancer + Table Grid OCR Parser)
 * - Nâng cấp hình ảnh qua Canvas: Phóng to thông minh (Bicubic), Khử nền màu / giữ chữ Đỏ & Đen,
 *   Khử bóng / cân bằng nền cục bộ (Morphological Background Normalization), Làm nét (Unsharp Mask).
 * - Tự động nhận diện cấu trúc bảng (Horizontal/Vertical Grid Lines), tách tiêu đề & từng cột,
 *   OCR theo khe hàng cố định (Column-Slot OCR) để không bao giờ bị lệch dòng hay sót cột.
 * - Hỗ trợ fallback ảnh không có đường kẻ bảng & dán văn bản từ Google Lens / Zalo / Excel.
 */
class OCRParser {
    /**
     * Nạp file/URL ảnh thành HTMLImageElement
     */
    static loadImage(imageFile) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            let objectUrl = null;
            img.onload = () => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                resolve(img);
            };
            img.onerror = () => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                reject(new Error('Không thể đọc file hình ảnh.'));
            };
            if (typeof imageFile === 'string') {
                img.crossOrigin = 'anonymous';
                img.src = imageFile;
            } else {
                objectUrl = URL.createObjectURL(imageFile);
                img.src = objectUrl;
            }
        });
    }

    /**
     * Nâng cấp chất lượng ảnh trên Canvas:
     * 1. Chuẩn hóa nền cục bộ (loại bỏ nền xanh, vàng, xám, bóng đổ) mà vẫn giữ nguyên chữ ĐEN và chữ ĐỎ
     * 2. Làm nét Unsharp Mask (giúp số nhỏ, dấu phẩy/chấm và dấu tiếng Việt sắc nét)
     * 3. Kéo giãn tương phản mượt (giữ anti-aliasing cho Tesseract LSTM đọc chính xác)
     */
    static enhanceCanvas(canvas, options = {}) {
        const {
            sharpenAmount = 0.65,
            useLocalBg = true,
            bgRadius = 18,
            lowThreshold = 42,
            highThreshold = 135,
            binary = false
        } = options;

        const w = canvas.width;
        const h = canvas.height;
        if (!w || !h) return canvas;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        const total = w * h;

        // Tính độ sáng (luma) và tín hiệu chữ đỏ (redBoost) cho từng pixel
        const luma = new Float32Array(total);
        const redBoost = new Float32Array(total);
        for (let i = 0; i < total; i++) {
            const idx = i * 4;
            const r = d[idx];
            const g = d[idx + 1];
            const b = d[idx + 2];
            luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
            // Tín hiệu chữ đỏ/cam trên nền sáng hoặc vàng: R vượt trội so với G và B
            const maxGB = g > b ? g : b;
            redBoost[i] = r > 85 && r > maxGB + 25 ? (r - maxGB) : 0;
        }

        // Ước lượng độ sáng nền cục bộ bằng bộ lọc Max 1D tách lớp (separable dilation)
        let localBg = null;
        if (useLocalBg) {
            const tmp = new Float32Array(total);
            localBg = new Float32Array(total);
            const r = Math.min(bgRadius, Math.max(4, Math.floor(Math.min(w, h) / 4)));

            // Ngang
            for (let y = 0; y < h; y++) {
                const rowOff = y * w;
                for (let x = 0; x < w; x++) {
                    const x0 = x - r > 0 ? x - r : 0;
                    const x1 = x + r < w ? x + r : w - 1;
                    let mx = 0;
                    for (let k = x0; k <= x1; k++) {
                        const v = luma[rowOff + k];
                        if (v > mx) mx = v;
                    }
                    tmp[rowOff + x] = mx;
                }
            }
            // Dọc
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    const y0 = y - r > 0 ? y - r : 0;
                    const y1 = y + r < h ? y + r : h - 1;
                    let mx = 0;
                    for (let k = y0; k <= y1; k++) {
                        const v = tmp[k * w + x];
                        if (v > mx) mx = v;
                    }
                    localBg[y * w + x] = mx;
                }
            }
        }

        // Tính điểm mực (inkScore): càng cao càng đậm nét
        const ink = new Float32Array(total);
        for (let i = 0; i < total; i++) {
            const bg = localBg ? localBg[i] : 255;
            const darkDiff = Math.max(0, bg - luma[i]);
            const score = Math.max(darkDiff, redBoost[i] * 1.45);
            ink[i] = score > 255 ? 255 : score;
        }

        // Làm nét Unsharp Mask (3x3) trên bản đồ ink
        let finalInk = ink;
        if (sharpenAmount > 0 && w >= 3 && h >= 3) {
            finalInk = new Float32Array(total);
            for (let y = 0; y < h; y++) {
                const rowOff = y * w;
                const yUp = y > 0 ? (y - 1) * w : rowOff;
                const yDn = y < h - 1 ? (y + 1) * w : rowOff;
                for (let x = 0; x < w; x++) {
                    const xL = x > 0 ? x - 1 : x;
                    const xR = x < w - 1 ? x + 1 : x;
                    const c = ink[rowOff + x];
                    const avg = (
                        ink[yUp + xL] + ink[yUp + x] + ink[yUp + xR] +
                        ink[rowOff + xL] + c + ink[rowOff + xR] +
                        ink[yDn + xL] + ink[yDn + x] + ink[yDn + xR]
                    ) / 9;
                    const sharp = c + sharpenAmount * (c - avg);
                    finalInk[rowOff + x] = sharp < 0 ? 0 : (sharp > 255 ? 255 : sharp);
                }
            }
        }

        // Áp vào pixel đầu ra (chữ đen trên nền trắng sạch, giữ biên mượt hoặc nhị phân)
        const span = Math.max(1, highThreshold - lowThreshold);
        for (let i = 0; i < total; i++) {
            const s = finalInk[i];
            let gray;
            if (binary) {
                gray = s >= (lowThreshold + highThreshold) * 0.5 ? 0 : 255;
            } else if (s <= lowThreshold) {
                gray = 255;
            } else if (s >= highThreshold) {
                gray = 0;
            } else {
                gray = Math.round(255 * (1 - (s - lowThreshold) / span));
            }
            const idx = i * 4;
            d[idx] = gray;
            d[idx + 1] = gray;
            d[idx + 2] = gray;
            d[idx + 3] = 255;
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    /**
     * Tiền xử lý hình ảnh tổng quát qua Canvas (giữ tương thích API cũ + dùng bộ lọc nâng cấp mới)
     */
    static async preprocessImage(imageFile, enhanceMode = 'auto') {
        try {
            const img = await OCRParser.loadImage(imageFile);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const scale = Math.max(1, Math.min(2.5, 2800 / img.width));
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const opts = enhanceMode === 'strong'
                ? { sharpenAmount: 0.75, useLocalBg: true, bgRadius: 18, lowThreshold: 28, highThreshold: 118, binary: false }
                : enhanceMode === 'high_contrast'
                    ? { sharpenAmount: 0.65, useLocalBg: true, bgRadius: 20, lowThreshold: 55, highThreshold: 110, binary: true }
                    : { sharpenAmount: 0.25, useLocalBg: true, bgRadius: 16, lowThreshold: 26, highThreshold: 155, binary: false };

            OCRParser.enhanceCanvas(canvas, opts);
            return canvas.toDataURL('image/png');
        } catch (e) {
            console.warn('preprocessImage error:', e);
            return null;
        }
    }

    /**
     * Phát hiện lưới đường kẻ bảng (ngang & dọc) từ ảnh gốc
     */
    static detectTableGrid(srcCanvas) {
        const w = srcCanvas.width;
        const h = srcCanvas.height;
        const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
        const d = ctx.getImageData(0, 0, w, h).data;

        // 1. Tính tỷ lệ pixel đường kẻ tối màu (luma < 175 và ít bão hòa màu) theo từng hàng y
        const hRatio = new Float32Array(h);
        for (let y = 0; y < h; y++) {
            let darkCount = 0;
            const rowOff = y * w * 4;
            for (let x = 0; x < w; x++) {
                const idx = rowOff + x * 4;
                const r = d[idx], g = d[idx + 1], b = d[idx + 2];
                const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
                const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
                if (luma < 180 && (maxC - minC) < 55) {
                    darkCount++;
                }
            }
            hRatio[y] = darkCount / w;
        }

        // Gom cụm các đường kẻ ngang (đường kẻ bảng liên tục > 72% chiều rộng ảnh)
        const hLines = [];
        let y = 0;
        while (y < h) {
            if (hRatio[y] > 0.72) {
                const yStart = y;
                while (y + 1 < h && hRatio[y + 1] > 0.60) y++;
                const yEnd = y;
                if (hLines.length > 0 && yStart - hLines[hLines.length - 1].yEnd <= 6) {
                    hLines[hLines.length - 1].yEnd = yEnd;
                } else {
                    hLines.push({ yStart, yEnd });
                }
            }
            y++;
        }

        if (hLines.length < 4) return null;

        const tableTop = hLines[0].yEnd;
        const tableBottom = hLines[hLines.length - 1].yStart;
        const tableH = tableBottom - tableTop;
        if (tableH < 80) return null;

        // 2. Tính tỷ lệ pixel đường kẻ dọc trong phạm vi [tableTop, tableBottom]
        // Đường kẻ dọc thật sự chạy xuyên suốt chiều cao bảng (> 85%), tránh nhầm với nét chữ thẳng hàng
        const vRatio = new Float32Array(w);
        for (let x = 0; x < w; x++) {
            let darkCount = 0;
            for (let yy = tableTop; yy <= tableBottom; yy++) {
                const idx = (yy * w + x) * 4;
                const r = d[idx], g = d[idx + 1], b = d[idx + 2];
                const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
                const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
                if (luma < 185 && (maxC - minC) < 55) {
                    darkCount++;
                }
            }
            vRatio[x] = darkCount / tableH;
        }

        const vLines = [];
        let x = 0;
        while (x < w) {
            if (vRatio[x] > 0.85) {
                const xStart = x;
                while (x + 1 < w && vRatio[x + 1] > 0.78) x++;
                const xEnd = x;
                if (vLines.length > 0 && xStart - vLines[vLines.length - 1].xEnd <= 6) {
                    vLines[vLines.length - 1].xEnd = xEnd;
                } else {
                    vLines.push({ xStart, xEnd });
                }
            }
            x++;
        }

        // Bổ sung mép trái/phải nếu bảng không vẽ viền ngoài cùng
        if (vLines.length >= 2) {
            if (vLines[0].xStart > 25) vLines.unshift({ xStart: 0, xEnd: 1 });
            if (w - vLines[vLines.length - 1].xEnd > 25) vLines.push({ xStart: w - 2, xEnd: w - 1 });
        }

        if (vLines.length < 4) return null;

        // Tạo danh sách các hàng và cột (cắt lùi vào trong viền 2px để xóa hoàn toàn đường kẻ)
        const rows = [];
        for (let i = 0; i < hLines.length - 1; i++) {
            const y0 = hLines[i].yEnd + 2;
            const y1 = hLines[i + 1].yStart - 2;
            if (y1 - y0 >= 14) {
                rows.push({ y0, y1, h: y1 - y0 });
            }
        }

        const cols = [];
        for (let j = 0; j < vLines.length - 1; j++) {
            const x0 = vLines[j].xEnd + 2;
            const x1 = vLines[j + 1].xStart - 2;
            if (x1 - x0 >= 18) {
                cols.push({ x0, x1, w: x1 - x0 });
            }
        }

        if (rows.length < 3 || cols.length < 3) return null;

        return {
            bannerBottom: hLines[0].yStart,
            rows,
            cols
        };
    }

    /**
     * Tạo dải ảnh dọc cho 1 cột (hoặc 1 hàng tiêu đề) đặt vào các khe cố định SLOT_H
     * giúp Tesseract nhận diện sạch 100%, không bị lẫn hàng hay viền bảng.
     */
    static buildSlotStripCanvas(srcCanvas, cells, options = {}) {
        const {
            targetCellH = 44,
            slotPadY = 20,
            padX = 24,
            enhanceOpts = {}
        } = options;

        if (!cells || cells.length === 0) return null;

        // Tính tỷ lệ phóng đồng đều theo chiều cao trung bình của ô để chữ nét căng
        const avgH = cells.reduce((s, c) => s + c.h, 0) / cells.length;
        const scale = Math.max(1, Math.min(3.0, targetCellH / Math.max(12, avgH)));

        const maxScaledW = Math.ceil(Math.max(...cells.map(c => c.w)) * scale);
        const maxScaledH = Math.ceil(Math.max(...cells.map(c => c.h)) * scale);
        const slotH = maxScaledH + slotPadY * 2;

        const outCanvas = document.createElement('canvas');
        outCanvas.width = maxScaledW + padX * 2;
        outCanvas.height = slotH * cells.length;

        const ctx = outCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            const dw = Math.round(c.w * scale);
            const dh = Math.round(c.h * scale);
            const dx = padX;
            const dy = i * slotH + Math.round((slotH - dh) / 2);
            ctx.drawImage(srcCanvas, c.x0, c.y0, c.w, c.h, dx, dy, dw, dh);
        }

        OCRParser.enhanceCanvas(outCanvas, {
            sharpenAmount: 0.65,
            useLocalBg: true,
            bgRadius: 16,
            lowThreshold: 40,
            highThreshold: 132,
            binary: false,
            ...enhanceOpts
        });

        return { canvas: outCanvas, slotH };
    }

    /**
     * Gom các từ Tesseract trả về vào từng khe hàng dựa trên tọa độ Y trung tâm
     */
    static mapWordsToSlots(data, slotH, numSlots) {
        const slotWords = Array.from({ length: numSlots }, () => []);
        const words = data?.words || [];

        if (words.length > 0) {
            for (const w of words) {
                const txt = (w.text || '').trim();
                if (!txt) continue;
                const cy = (w.bbox.y0 + w.bbox.y1) * 0.5;
                const idx = Math.floor(cy / slotH);
                if (idx >= 0 && idx < numSlots) {
                    slotWords[idx].push(w);
                }
            }
        } else if (data?.lines?.length > 0) {
            for (const ln of data.lines) {
                const txt = (ln.text || '').trim();
                if (!txt) continue;
                const cy = (ln.bbox.y0 + ln.bbox.y1) * 0.5;
                const idx = Math.floor(cy / slotH);
                if (idx >= 0 && idx < numSlots) {
                    slotWords[idx].push({ text: txt, bbox: ln.bbox });
                }
            }
        }

        return slotWords.map(arr => {
            if (arr.length === 0) return '';
            // Sắp xếp theo dòng (y) rồi trái sang phải (x)
            arr.sort((a, b) => {
                const ay = (a.bbox.y0 + a.bbox.y1) * 0.5;
                const by = (b.bbox.y0 + b.bbox.y1) * 0.5;
                const h = Math.max(10, a.bbox.y1 - a.bbox.y0);
                if (Math.abs(ay - by) > h * 0.55) return ay - by;
                return a.bbox.x0 - b.bbox.x0;
            });
            return arr.map(w => w.text.trim()).join(' ').replace(/\s+/g, ' ').trim();
        });
    }

    /**
     * Trích xuất tiêu đề & ngày áp dụng từ vùng banner phía trên bảng
     */
    static parseBannerInfo(text) {
        if (!text) return null;
        const clean = text.replace(/\s+/g, ' ').trim();
        // Dạng 13-14-15/11 hoặc 06-07-08/11
        const tripleMatch = clean.match(/(\d{1,2})\s*[-–]\s*\d{1,2}\s*[-–]\s*(\d{1,2})\s*[/\\]\s*(\d{1,2})/);
        if (tripleMatch) {
            const d1 = tripleMatch[1].padStart(2, '0');
            const d2 = tripleMatch[2].padStart(2, '0');
            const m = tripleMatch[3].padStart(2, '0');
            return {
                title: `Giờ Vàng ${d1}/${m} - ${d2}/${m}`,
                dateText: `ÁP DỤNG: ${d1}/${m} - ${d2}/${m}`
            };
        }
        // Dạng 16/10 - 18/10 hoặc 16-18/10
        const rangeMatch = clean.match(/(\d{1,2})\s*[/\\]\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\s*[/\\]\s*(\d{1,2})/);
        if (rangeMatch) {
            const d1 = rangeMatch[1].padStart(2, '0');
            const m1 = rangeMatch[2].padStart(2, '0');
            const d2 = rangeMatch[3].padStart(2, '0');
            const m2 = rangeMatch[4].padStart(2, '0');
            return {
                title: `Giờ Vàng ${d1}/${m1} - ${d2}/${m2}`,
                dateText: `ÁP DỤNG: ${d1}/${m1} - ${d2}/${m2}`
            };
        }
        const shortRange = clean.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*[/\\]\s*(\d{1,2})/);
        if (shortRange) {
            const d1 = shortRange[1].padStart(2, '0');
            const d2 = shortRange[2].padStart(2, '0');
            const m = shortRange[3].padStart(2, '0');
            return {
                title: `Giờ Vàng ${d1}/${m} - ${d2}/${m}`,
                dateText: `ÁP DỤNG: ${d1}/${m} - ${d2}/${m}`
            };
        }
        return null;
    }

    /**
     * Chuẩn hóa văn bản không dấu để nhận diện tên cột
     */
    static normAscii(str) {
        return String(str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9\s/]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Làm sạch tên vùng RSM đọc từ OCR
     */
    static cleanRegion(raw) {
        const n = OCRParser.normAscii(raw);
        if (!n) return 'Vùng Hồ Chí Minh';
        if (n.includes('ho chi minh') || n.includes('hcm')) return 'Vùng Hồ Chí Minh';
        return raw.trim();
    }

    /**
     * Làm sạch tên nhóm hàng đọc từ OCR
     */
    static cleanGroupName(raw, tenSP = '') {
        const n = OCRParser.normAscii(raw);
        if (!n || n.length < 2) return OCRParser.detectGroup(tenSP);
        if (n.includes('tivi') || n === 'tv' || n === 'tivvi') return 'TiVi';
        if (n.includes('loa') || n.includes('karaoke')) return 'Loa Karaoke';
        if (n.includes('may giat') || n.includes('giat')) return 'Máy giặt';
        if (n.includes('rua chen') || n.includes('rua bat') || n.includes('rira')) return 'Máy Rửa Chén';
        if (n.includes('tu lanh')) return 'Tủ Lạnh';
        if (n.includes('tu dong')) return 'Tủ Đông';
        if (n.includes('tu mat')) return 'Tủ Mát';
        if (n.includes('loc nuoc')) return 'Máy Lọc Nước';
        if (n.includes('bep gas') || n.includes('bep ga')) return n.includes('gas') ? 'Bếp Gas Đôi' : 'Bếp Ga Đôi';
        if (n.includes('bep dien tu')) return 'Bếp Điện Từ';
        if (n.includes('noi com nap gai')) return 'Nồi Cơm Nắp Gài';
        if (n.includes('noi com cao tan')) return 'Nồi Cơm Cao Tần';
        if (n.includes('noi com dien tu')) return 'Nồi Cơm Điện Tử';
        if (n.includes('ban ui')) return 'Bàn Ủi';
        if (n.includes('lo vi song')) return 'Lò Vi Sóng';
        return raw.trim();
    }

    /**
     * Làm sạch tên sản phẩm đọc từ OCR (sửa lỗi dấu tiếng Việt phổ biến)
     */
    static cleanProductName(raw) {
        if (!raw) return '';
        return raw
            .replace(/^[|lI1•\-–_.\s]+(?=[A-ZÀ-Ỹ])/g, '')
            .replace(/\s*[|]+\s*/g, ' ')
            .replace(/\bTú\s+lạnh\b/gi, 'Tủ lạnh')
            .replace(/\bT[uú]\s+Lạnh\b/g, 'Tủ Lạnh')
            .replace(/\bT[uủ]\s+dong\b/gi, 'Tủ đông')
            .replace(/\bT[uủ]\s+m[aá]t\b/gi, 'Tủ mát')
            .replace(/\bM[aá]y\s+gi[aă]t\b/gi, 'Máy giặt')
            .replace(/\bMay\s+giặt\b/g, 'Máy giặt')
            .replace(/\bMay\s+lọc\s+nước\b/g, 'Máy lọc nước')
            .replace(/\bMay\s+rửa\b/g, 'Máy rửa')
            .replace(/\brửa\s+bat\b/gi, 'rửa bát')
            .replace(/\bt[uúả]\s+d[uứ]ng\b/gi, 'tủ đứng')
            .replace(/\bt[uú]\s+đứng\b/gi, 'tủ đứng')
            .replace(/\bta\s+đứng\b/gi, 'tủ đứng')
            .replace(/\bnắp\s+gai\b/gi, 'nắp gài')
            .replace(/\bcao\s+tan\b/gi, 'cao tần')
            .replace(/\bH[oò]a\s+Phat\b/gi, 'Hòa Phát')
            .replace(/\b(\d+)\s+lit\b/gi, '$1 lít')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Làm sạch cột Suất/Siêu thị đọc từ OCR
     */
    static cleanQuota(raw) {
        if (!raw) return 'Suất ưu đãi';
        const n = OCRParser.normAscii(raw);
        if (n.includes('khong gioi han')) return 'Không Giới Hạn Số Lượng';
        const m = n.match(/(\d+)\s*suat/);
        if (m) return `${m[1]} suất / siêu thị`;
        return raw.trim();
    }

    /**
     * Phân giải bảng có cấu trúc lưới bằng Column-Slot OCR
     */
    static async extractFromTableGrid(srcCanvas, grid, worker, progressCallback, enhanceMode = 'auto') {
        const { rows, cols, bannerBottom } = grid;
        const baseEnhance = enhanceMode === 'strong'
            ? { sharpenAmount: 0.75, useLocalBg: true, bgRadius: 18, lowThreshold: 28, highThreshold: 118, binary: false }
            : enhanceMode === 'high_contrast'
                ? { sharpenAmount: 0.65, useLocalBg: true, bgRadius: 20, lowThreshold: 55, highThreshold: 110, binary: true }
                : { sharpenAmount: 0.12, useLocalBg: true, bgRadius: 16, lowThreshold: 24, highThreshold: 165, binary: false };

        // 1. Đọc banner tiêu đề (cắt phần giữa 17%..78% để tránh sticker ngày cũ ở góc phải)
        let campaign = null;
        if (bannerBottom > 40) {
            if (progressCallback) progressCallback(22, 'Đang nhận diện tiêu đề & ngày áp dụng...');
            const bx0 = Math.round(srcCanvas.width * 0.17);
            const bw = Math.round(srcCanvas.width * 0.61);
            const bannerCanvas = document.createElement('canvas');
            const bScale = Math.max(1, Math.min(2.2, 1800 / bw));
            bannerCanvas.width = Math.round(bw * bScale);
            bannerCanvas.height = Math.round(bannerBottom * bScale);
            const bCtx = bannerCanvas.getContext('2d');
            bCtx.imageSmoothingEnabled = true;
            bCtx.imageSmoothingQuality = 'high';
            bCtx.drawImage(srcCanvas, bx0, 0, bw, bannerBottom, 0, 0, bannerCanvas.width, bannerCanvas.height);
            OCRParser.enhanceCanvas(bannerCanvas, baseEnhance);

            await worker.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: '' });
            const bRet = await worker.recognize(bannerCanvas);
            campaign = OCRParser.parseBannerInfo(bRet.data.text);
        }

        // 2. Xác định hàng tiêu đề (kiểm tra hàng 0)
        if (progressCallback) progressCallback(30, 'Đang phân tích cấu trúc các cột bảng...');
        const headerRow = rows[0];
        const headerCells = cols.map(c => ({ x0: c.x0, y0: headerRow.y0, w: c.w, h: headerRow.h }));
        const headerStrip = OCRParser.buildSlotStripCanvas(srcCanvas, headerCells, {
            targetCellH: 42,
            slotPadY: 18,
            enhanceOpts: baseEnhance
        });
        await worker.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: '' });
        const hRet = await worker.recognize(headerStrip.canvas);
        const headerTexts = OCRParser.mapWordsToSlots(hRet.data, headerStrip.slotH, cols.length);

        // Ánh xạ cột theo tên tiêu đề
        const colMap = {
            group: -1,
            region: -1,
            sku: -1,
            name: -1,
            origPrice: -1,
            promoPrice: -1,
            quota: -1
        };

        const priceCols = [];
        let hasHeaderKeywords = false;

        headerTexts.forEach((txt, idx) => {
            const n = OCRParser.normAscii(txt);
            if (!n) return;
            if (n.includes('nhom') || n.includes('nganh')) {
                colMap.group = idx;
                hasHeaderKeywords = true;
            } else if (n.includes('vung') || n.includes('rsm')) {
                colMap.region = idx;
                hasHeaderKeywords = true;
            } else if (n.includes('ma san') || n.includes('ma sp') || n.includes('sku') || n === 'ma') {
                colMap.sku = idx;
                hasHeaderKeywords = true;
            } else if (n.includes('san pham') || n.includes('ten sp') || n.includes('model')) {
                colMap.name = idx;
                hasHeaderKeywords = true;
            } else if (n.includes('suat') || n.includes('sieu thi') || n.includes('so luong') || n.includes('ghi chu')) {
                colMap.quota = idx;
                hasHeaderKeywords = true;
            } else if (n.includes('gia') || n.includes('gvgs') || n.includes('niem yet') || n.includes('khuyen mai')) {
                priceCols.push({ idx, norm: n });
                hasHeaderKeywords = true;
            }
        });

        if (priceCols.length >= 2) {
            const promoCandidate = priceCols.find(c =>
                c.norm.includes('gvgs') || c.norm.includes('giam') || c.norm.includes('km') || c.norm.includes('event') || c.norm.includes('ban')
            );
            if (promoCandidate) {
                colMap.promoPrice = promoCandidate.idx;
                colMap.origPrice = priceCols.find(c => c.idx !== promoCandidate.idx)?.idx ?? -1;
            } else {
                colMap.origPrice = priceCols[0].idx;
                colMap.promoPrice = priceCols[1].idx;
            }
        } else if (priceCols.length === 1) {
            colMap.promoPrice = priceCols[0].idx;
        }

        // Dự phòng nếu bảng chuẩn 7 cột MWG nhưng header đọc thiếu
        if (cols.length === 7) {
            if (colMap.group === -1) colMap.group = 0;
            if (colMap.region === -1) colMap.region = 1;
            if (colMap.sku === -1) colMap.sku = 2;
            if (colMap.name === -1) colMap.name = 3;
            if (colMap.origPrice === -1) colMap.origPrice = 4;
            if (colMap.promoPrice === -1) colMap.promoPrice = 5;
            if (colMap.quota === -1) colMap.quota = 6;
        }

        const dataRows = hasHeaderKeywords ? rows.slice(1) : rows;
        if (dataRows.length === 0) return { products: [], campaign };

        // 3. OCR từng cột theo khe hàng cố định (Column-Slot OCR)
        const columnsToRead = [
            { key: 'sku', idx: colMap.sku, label: 'Mã sản phẩm', whitelist: '0123456789' },
            { key: 'name', idx: colMap.name, label: 'Tên sản phẩm', whitelist: '' },
            { key: 'origPrice', idx: colMap.origPrice, label: 'Giá gốc', whitelist: '0123456789.,' },
            { key: 'promoPrice', idx: colMap.promoPrice, label: 'Giá khuyến mãi', whitelist: '0123456789.,' },
            { key: 'group', idx: colMap.group, label: 'Nhóm hàng', whitelist: '' },
            { key: 'region', idx: colMap.region, label: 'Vùng RSM', whitelist: '' },
            { key: 'quota', idx: colMap.quota, label: 'Suất ưu đãi', whitelist: '' }
        ].filter(c => c.idx >= 0 && c.idx < cols.length);

        const colResults = {};
        for (let step = 0; step < columnsToRead.length; step++) {
            const spec = columnsToRead[step];
            const pct = 35 + Math.round(((step + 1) / columnsToRead.length) * 58);
            if (progressCallback) {
                progressCallback(pct, `Đang quét cột "${spec.label}" (${step + 1}/${columnsToRead.length})...`);
            }

            const col = cols[spec.idx];
            const cells = dataRows.map(r => ({ x0: col.x0, y0: r.y0, w: col.w, h: r.h }));
            const strip = OCRParser.buildSlotStripCanvas(srcCanvas, cells, {
                targetCellH: 72,
                slotPadY: 22,
                padX: 32,
                enhanceOpts: baseEnhance
            });

            await worker.setParameters({
                tessedit_pageseg_mode: '6',
                tessedit_char_whitelist: spec.whitelist
            });
            const ret = await worker.recognize(strip.canvas);
            colResults[spec.key] = OCRParser.mapWordsToSlots(ret.data, strip.slotH, dataRows.length);
        }

        // 4. Tổng hợp danh sách sản phẩm chuẩn xác theo từng hàng
        const products = [];
        const stamp = Date.now().toString(36);
        const noteText = campaign ? `Trích xuất ảnh (${campaign.title})` : 'Trích xuất từ ảnh (Nâng cao)';

        for (let r = 0; r < dataRows.length; r++) {
            const tenSP = OCRParser.cleanProductName(colResults.name?.[r] || '');
            const maSP = (colResults.sku?.[r] || '').replace(/\D/g, '');
            let p1 = ExcelParser.parsePrice(colResults.origPrice?.[r] || '');
            let p2 = ExcelParser.parsePrice(colResults.promoPrice?.[r] || '');

            // Bỏ qua hàng trống hoặc nhiễu không có tên và giá
            if (!tenSP && p1 === 0 && p2 === 0) continue;
            if (p1 === 0 && p2 === 0) continue;

            if (p1 > 0 && p2 === 0) p2 = p1;
            if (p2 > 0 && p1 === 0) p1 = p2;

            const giaNiemYet = Math.max(p1, p2);
            const giaEvent = Math.min(p1, p2);

            const rawGroup = (colResults.group?.[r] || '').trim();
            const nhom = OCRParser.cleanGroupName(rawGroup, tenSP);

            const vung = OCRParser.cleanRegion(colResults.region?.[r] || '');
            const khungGio = OCRParser.cleanQuota(colResults.quota?.[r] || '');

            products.push({
                id: `sp-img-${r + 1}-${stamp}`,
                nhom,
                vung,
                maSP,
                tenSP: tenSP || `Sản phẩm ${maSP || (r + 1)}`,
                giaNiemYet,
                giaEvent,
                khungGio,
                ghiChu: noteText,
                selected: true
            });
        }

        return { products, campaign };
    }

    /**
     * Gom từ theo hàng ngang (dùng khi ảnh không có đường kẻ lưới bảng)
     */
    static reconstructRowsFromWords(data) {
        const words = (data?.words || []).filter(w => (w.text || '').trim().length > 0);
        if (words.length === 0) return data?.text || '';

        const sorted = [...words].sort((a, b) => {
            const ay = (a.bbox.y0 + a.bbox.y1) * 0.5;
            const by = (b.bbox.y0 + b.bbox.y1) * 0.5;
            return ay - by;
        });

        const rows = [];
        for (const w of sorted) {
            const cy = (w.bbox.y0 + w.bbox.y1) * 0.5;
            const wh = Math.max(10, w.bbox.y1 - w.bbox.y0);
            const lastRow = rows[rows.length - 1];
            if (lastRow && Math.abs(cy - lastRow.avgY) <= Math.max(lastRow.avgH, wh) * 0.6) {
                lastRow.words.push(w);
                lastRow.avgY = lastRow.words.reduce((s, item) => s + (item.bbox.y0 + item.bbox.y1) * 0.5, 0) / lastRow.words.length;
                lastRow.avgH = lastRow.words.reduce((s, item) => s + (item.bbox.y1 - item.bbox.y0), 0) / lastRow.words.length;
            } else {
                rows.push({ avgY: cy, avgH: wh, words: [w] });
            }
        }

        return rows.map(row => {
            row.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
            return row.words.map(w => w.text.trim()).join(' ');
        }).join('\n');
    }

    /**
     * Nhận diện hình ảnh và trích xuất bảng giá
     */
    static async recognizeImage(imageFile, progressCallback, options = {}) {
        const enhanceMode = options.enhanceMode || 'auto';

        if (progressCallback) progressCallback(8, 'Đang nạp & kiểm tra cấu trúc hình ảnh...');

        if (!window.Tesseract) {
            throw new Error('Thư viện Tesseract OCR chưa sẵn sàng.');
        }

        const img = await OCRParser.loadImage(imageFile);

        // Vẽ ảnh gốc lên Canvas (phóng to nhẹ nếu ảnh có chiều rộng nhỏ)
        const srcCanvas = document.createElement('canvas');
        const baseScale = img.width < 2200 ? Math.min(2.5, 2400 / img.width) : 1;
        srcCanvas.width = Math.round(img.width * baseScale);
        srcCanvas.height = Math.round(img.height * baseScale);
        const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
        srcCtx.imageSmoothingEnabled = true;
        srcCtx.imageSmoothingQuality = 'high';
        srcCtx.drawImage(img, 0, 0, srcCanvas.width, srcCanvas.height);

        // Phát hiện lưới bảng (nếu là ảnh bảng giá Excel / Giờ Vàng)
        const grid = OCRParser.detectTableGrid(srcCanvas);

        if (progressCallback) progressCallback(15, 'Đang khởi tạo bộ nhận diện AI OCR (vie+eng)...');

        const worker = await Tesseract.createWorker('vie+eng', 1, {
            logger: m => {
                if (!grid && m.status === 'recognizing text' && progressCallback) {
                    const pct = Math.round(m.progress * 60) + 30;
                    progressCallback(pct, `Đang quét chữ và số: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        try {
            // Nhánh 1: Ảnh bảng có lưới kẻ -> Dùng Column-Slot OCR chính xác từng ô
            if (grid) {
                const tableResult = await OCRParser.extractFromTableGrid(
                    srcCanvas,
                    grid,
                    worker,
                    progressCallback,
                    enhanceMode
                );

                if (tableResult.products && tableResult.products.length > 0) {
                    if (progressCallback) {
                        progressCallback(100, `Hoàn tất trích xuất ${tableResult.products.length} sản phẩm từ bảng!`);
                    }
                    return tableResult;
                }
            }

            // Nhánh 2: Ảnh không có lưới kẻ rõ ràng -> Nâng cấp toàn ảnh + ghép hàng theo tọa độ Y
            if (progressCallback) progressCallback(25, 'Đang nâng cấp độ nét & cân bằng nền ảnh...');
            const enhancedDataUrl = await OCRParser.preprocessImage(imageFile, enhanceMode);

            await worker.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: '' });
            const ret = await worker.recognize(enhancedDataUrl || srcCanvas);

            if (progressCallback) progressCallback(95, 'Đang phân tích và khớp dữ liệu...');

            const rowText = OCRParser.reconstructRowsFromWords(ret.data);
            const rawText = ret.data.text || '';
            const bannerCampaign = OCRParser.parseBannerInfo(rawText) || OCRParser.parseBannerInfo(rowText);

            let parsed = OCRParser.parseSmartText(rowText);
            if (!parsed || parsed.length === 0) {
                parsed = OCRParser.parseSmartText(rawText);
            }

            return {
                products: parsed,
                campaign: bannerCampaign
            };
        } finally {
            await worker.terminate();
        }
    }

    /**
     * Bộ phân giải bảng thông minh từ văn bản thô (Hỗ trợ cả dán từ Google Lens, Zalo, Excel)
     */
    static parseSmartText(rawText) {
        if (!rawText) return [];

        // Hỗ trợ dán trực tiếp dữ liệu CSV / TSV của "File in Popup Thường ngày" (Model: AS [44], Giá gốc: AH [33], Giá KM: AE [30])
        if (typeof XLSX !== 'undefined' && typeof ExcelParser !== 'undefined' &&
            (rawText.includes('Giá chỉ giao hàng') || rawText.includes('Giá giao + lắp đặt') || rawText.split('\n')[0]?.split('\t').length >= 45)) {
            try {
                const wb = XLSX.read(rawText, { type: 'string' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                if (ExcelParser.isDailyPopupFormat(rows)) {
                    const extracted = ExcelParser.extractDailyPopupRows(rows);
                    if (extracted.products && extracted.products.length > 0) {
                        return extracted.products;
                    }
                }
            } catch (e) {
                console.warn('Daily popup paste parse fallback:', e);
            }
        }

        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
        const products = [];

        // Các mẫu nhận dạng
        const priceRegex = /(\d{1,3}[.,]\d{3}[.,]\d{3}|\d{1,3}[.,]\d{3}|\d{6,8})/g;
        const codeRegex = /\b(175\d{10}|304\d{10}|305\d{10}|484\d{10}|111\d{10}|\d{11,13})\b/;

        // Bước 1: Thử phân tích từng dòng đơn lẻ
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const prices = line.match(priceRegex);

            if (prices && prices.length >= 2) {
                const num1 = ExcelParser.parsePrice(prices[prices.length - 2]);
                const num2 = ExcelParser.parsePrice(prices[prices.length - 1]);
                if (num1 >= 100000 && num2 >= 100000) {
                    const giaNiemYet = Math.max(num1, num2);
                    const giaEvent = Math.min(num1, num2);

                    let tenSP = line.split(prices[prices.length - 2])[0].trim();
                    tenSP = tenSP.replace(/^\d+[\s.-]*/, '').replace(/Vùng\s*Hồ\s*Chí\s*Minh/gi, '').trim();

                    const codeMatch = line.match(codeRegex);
                    const maSP = codeMatch ? codeMatch[0] : '';
                    if (maSP && tenSP.includes(maSP)) {
                        tenSP = tenSP.replace(maSP, '').trim();
                    }

                    // Loại bỏ tên nhóm ở đầu dòng nếu dính vào tên sản phẩm
                    tenSP = tenSP.replace(/^(TiVi|Loa Karaoke|Máy giặt|Máy Rửa Chén|Tủ Lạnh|Tủ Đông|Tủ Mát|Máy Lọc Nước|Bếp Gas Đôi|Nồi Cơm Nắp Gài|Bếp Điện Từ|Nồi Cơm Cao Tần|Bàn Ủi|Lò Vi Sóng|Nồi Cơm Điện Tử)\s+/i, '').trim();

                    if (tenSP.length >= 3) {
                        products.push({
                            id: `sp-ocr-${i}-${Date.now().toString(36)}`,
                            nhom: OCRParser.detectGroup(tenSP),
                            vung: 'Vùng Hồ Chí Minh',
                            maSP: maSP,
                            tenSP: tenSP,
                            giaNiemYet: giaNiemYet,
                            giaEvent: giaEvent,
                            khungGio: 'Suất ưu đãi',
                            ghiChu: 'Trích xuất từ ảnh',
                            selected: true
                        });
                        continue;
                    }
                }
            }
        }

        // Bước 2: Nếu phân tích từng dòng tìm được ít hơn 3 sản phẩm -> Dùng bộ quét khối liên tiếp (Multi-line window)
        if (products.length < 3) {
            let pendingName = '';
            let pendingCode = '';
            let pendingGroup = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Kiểm tra mã sản phẩm
                const codeMatch = line.match(codeRegex);
                if (codeMatch) {
                    pendingCode = codeMatch[0];
                }

                // Kiểm tra tên sản phẩm
                const grp = OCRParser.detectGroup(line);
                if (grp !== 'Sản phẩm' && line.length < 25) {
                    pendingGroup = grp;
                } else if (line.length > 5 && !line.match(priceRegex) && !line.match(codeRegex)) {
                    if (!line.toLowerCase().includes('vùng') && !line.toLowerCase().includes('suất')) {
                        pendingName = line;
                    }
                }

                // Kiểm tra giá tiền
                const prices = line.match(priceRegex);
                if (prices && prices.length >= 1 && pendingName) {
                    const num1 = ExcelParser.parsePrice(prices[0]);
                    const num2 = prices.length >= 2 ? ExcelParser.parsePrice(prices[1]) : Math.round(num1 * 0.7);

                    if (num1 >= 100000) {
                        products.push({
                            id: `sp-win-${i}-${Date.now().toString(36)}`,
                            nhom: pendingGroup || OCRParser.detectGroup(pendingName),
                            vung: 'Vùng Hồ Chí Minh',
                            maSP: pendingCode,
                            tenSP: pendingName,
                            giaNiemYet: Math.max(num1, num2),
                            giaEvent: Math.min(num1, num2),
                            khungGio: 'Suất ưu đãi',
                            ghiChu: 'Trích xuất tự động',
                            selected: true
                        });
                        pendingName = '';
                        pendingCode = '';
                    }
                }
            }
        }

        // Khử trùng lặp theo mã SP hoặc tên SP
        const uniqueProducts = [];
        const seen = new Set();
        for (const p of products) {
            const key = p.maSP ? `sku_${p.maSP}` : `name_${(p.tenSP || '').toLowerCase().trim()}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueProducts.push(p);
            }
        }

        return uniqueProducts;
    }

    static detectGroup(name) {
        if (!name) return 'Sản phẩm';
        const n = name.toLowerCase();
        if (n.includes('lọc nước') || n.includes('hòa phát hpn') || n.includes('karofi') || n.includes('ultrax') || n.includes('hpn639') || n.includes('kg12s')) return 'Máy Lọc Nước';
        if (n.includes('tivi') || n.includes('tv') || n.includes('qled') || n.includes('qned') || n.includes('bravia') || n.includes('55c6ks') || n.includes('65t6d')) return 'TiVi';
        if (n.includes('loa') || n.includes('karaoke') || n.includes('dalton') || n.includes('nanomax') || n.includes('bobos')) return 'Loa Karaoke';
        if (n.includes('giặt') || n.includes('máy sấy') || n.includes('rửa chén') || n.includes('rửa bát') || n.includes('junger') || n.includes('samsung wa') || n.includes('toshiba tw') || n.includes('electrolux') || n.includes('dk1300kv')) return 'Máy giặt';
        if (n.includes('tủ lạnh') || n.includes('hitachi') || n.includes('inverter 474') || n.includes('hrsn9563') || n.includes('rt535wea')) return 'Tủ Lạnh';
        if (n.includes('tủ mát') || n.includes('sanaky tm')) return 'Tủ Mát';
        if (n.includes('tủ đông') || n.includes('kangaroo kgfz') || n.includes('ad6352') || n.includes('hpf')) return 'Tủ Đông';
        if (n.includes('quạt') || n.includes('làm mát') || n.includes('qđh')) return 'Quạt điều hòa';
        if (n.includes('lò vi sóng') || n.includes('vi sóng') || n.includes('sharp r-211')) return 'Gia Dụng';
        if (n.includes('nồi cơm') || n.includes('bàn ủi') || n.includes('nồi chiên') || n.includes('bình đun') || n.includes('máy xay') || n.includes('sharp ks') || n.includes('chảo') || n.includes('bếp') || n.includes('kg15rih1') || n.includes('kgrc18m8') || n.includes('kg516m') || n.includes('kgic22s2')) return 'Gia Dụng';
        return 'Sản phẩm';
    }
}
