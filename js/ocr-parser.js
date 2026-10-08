/**
 * Xử lý nhận diện bảng giá từ hình ảnh (OCR Image Recognition)
 */
class OCRParser {
    static async recognizeImage(imageFile, progressCallback) {
        if (!window.Tesseract) {
            throw new Error('Thư viện Tesseract.js chưa được nạp.');
        }

        if (progressCallback) progressCallback(10, 'Đang chuẩn bị mô hình OCR...');

        const worker = await Tesseract.createWorker('vie+eng', 1, {
            logger: m => {
                if (m.status === 'recognizing text' && progressCallback) {
                    const pct = Math.round(m.progress * 80) + 15;
                    progressCallback(pct, `Đang nhận diện chữ: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        const ret = await worker.recognize(imageFile);
        await worker.terminate();

        if (progressCallback) progressCallback(95, 'Đang phân tích cấu trúc bảng giá...');

        const text = ret.data.text;
        const products = this.parseTextToProducts(text);

        return products;
    }

    /**
     * Phân tích văn bản OCR thành cấu trúc bảng sản phẩm
     */
    static parseTextToProducts(rawText) {
        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
        const products = [];

        // Tìm các dòng chứa giá tiền (có các cụm số từ 6 chữ số trở lên hoặc có dấu chấm/phẩy)
        const priceRegex = /(\d{1,3}[.,]\d{3}[.,]\d{3}|\d{6,8})/g;

        lines.forEach((line, idx) => {
            const prices = line.match(priceRegex);
            if (prices && prices.length >= 2) {
                // Lấy 2 số giá lớn nhất hoặc 2 số giá liên tiếp
                const num1 = ExcelParser.parsePrice(prices[0]);
                const num2 = ExcelParser.parsePrice(prices[1]);

                // Giá niêm yết thường lớn hơn giá khuyến mãi
                const giaNiemYet = Math.max(num1, num2);
                const giaEvent = Math.min(num1, num2);

                // Tên sản phẩm là phần chữ trước giá
                let tenSP = line.split(prices[0])[0].trim();
                tenSP = tenSP.replace(/^\d+[\s.-]*/, '').replace(/Vùng\s*Hồ\s*Chí\s*Minh/gi, '').trim();

                // Tìm mã sản phẩm (dãy 10-14 chữ số)
                const codeMatch = line.match(/\b(175\d{10}|304\d{10}|305\d{10}|484\d{10}|111\d{10}|\d{10,14})\b/);
                const maSP = codeMatch ? codeMatch[0] : '';

                if (tenSP.length > 3) {
                    products.push({
                        id: `sp-ocr-${idx}-${Date.now().toString(36)}`,
                        nhom: this.detectGroup(tenSP),
                        vung: 'Vùng Hồ Chí Minh',
                        maSP: maSP,
                        tenSP: tenSP,
                        giaNiemYet: giaNiemYet,
                        giaEvent: giaEvent,
                        khungGio: 'Suất ưu đãi',
                        ghiChu: 'Nhận diện từ ảnh',
                        selected: true
                    });
                }
            }
        });

        return products;
    }

    static detectGroup(name) {
        const n = name.toLowerCase();
        if (n.includes('tivi') || n.includes('tv')) return 'TiVi';
        if (n.includes('loa')) return 'Loa Karaoke';
        if (n.includes('giặt')) return 'Máy giặt';
        if (n.includes('tủ lạnh')) return 'Tủ Lạnh';
        if (n.includes('tủ mát')) return 'Tủ Mát';
        if (n.includes('tủ đông')) return 'Tủ Đông';
        if (n.includes('lọc nước')) return 'Máy Lọc Nước';
        if (n.includes('lò vi sóng') || n.includes('vi sóng')) return 'Gia Dụng';
        if (n.includes('nồi cơm') || n.includes('chảo') || n.includes('bếp')) return 'Gia Dụng';
        return 'Sản phẩm';
    }
}
