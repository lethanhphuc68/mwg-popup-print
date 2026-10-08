/**
 * Tạo và tùy biến Banner Tiêu Đề chuyên dụng cho IN TRẮNG ĐEN (Black & White Print Optimized)
 * Không phụ thuộc background-image, không lem mực, luôn sắc nét 100% trên máy in laser trắng đen.
 */
class BannerGenerator {
    static PRESETS = [
        { id: "grq", name: "GIÁ RẺ QUÁ", text: "GIÁ RẺ QUÁ" },
        { id: "gvgs", name: "GIỜ VÀNG GIÁ SỐC", text: "GIỜ VÀNG GIÁ SỐC" },
        { id: "xkgs", name: "XẢ KHO GIÁ SỐC", text: "XẢ KHO GIÁ SỐC" },
        { id: "kmdb", name: "KHUYẾN MÃI ĐẶC BIỆT", text: "KHUYẾN MÃI ĐẶC BIỆT" },
        { id: "ctgs", name: "CUỐI TUẦN GIẢM SỐC", text: "CUỐI TUẦN GIẢM SỐC" },
        { id: "dmx", name: "SIÊU SALE ĐIỆN MÁY", text: "SIÊU SALE ĐIỆN MÁY" }
    ];

    /**
     * Tạo SVG banner độ phân giải vector chuẩn in ấn (Chữ TO ĐẬM, CỰC KỲ HẤP DẪN, in laser trắng đen sắc nét 100%)
     */
    static getBannerSVG(text = "GIÁ RẺ QUÁ", theme = "bw_classic") {
        const cleanText = (text || "GIÁ RẺ QUÁ").trim().toUpperCase();
        
        // Tính toán kích thước font cực đại để chữ TO NHẤT, HẤP DẪN NHẤT
        let fontSize = 138;
        const textLen = cleanText.length;
        if (textLen > 20) {
            fontSize = 85;
        } else if (textLen > 16) {
            fontSize = 98;
        } else if (textLen > 13) {
            fontSize = 112;
        } else if (textLen > 10) {
            fontSize = 125;
        } else {
            fontSize = 138;
        }

        // KIỂU 1: TRẮNG ĐEN CHUẨN SIÊU THỊ (Chữ SIÊU TO, Đen đậm nét, Viền đôi cao cấp, Ngôi sao trợ lực)
        if (theme === "bw_classic") {
            return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 180" width="100%" height="100%" preserveAspectRatio="none">
                <!-- Viền ngoài dày dặn -->
                <rect x="5" y="5" width="990" height="170" fill="#ffffff" stroke="#000000" stroke-width="7"/>
                <!-- Viền trong đôi nét thanh lịch -->
                <rect x="13" y="13" width="974" height="154" fill="none" stroke="#000000" stroke-width="2.5"/>
                
                <!-- Huy hiệu Ngôi sao + Tia chớp bên trái -->
                <g transform="translate(26, 25) scale(0.65)" stroke="#000000" stroke-width="5" fill="#000000">
                    <polygon points="40,5 50,28 75,30 55,48 62,72 40,58 18,72 25,48 5,30 30,28" fill="#000000" stroke="none"/>
                    <line x1="40" y1="80" x2="40" y2="155" stroke-width="6"/>
                    <circle cx="40" cy="165" r="5" fill="#000000"/>
                </g>

                <!-- Huy hiệu Ngôi sao bên phải -->
                <g transform="translate(915, 25) scale(0.65)" stroke="#000000" stroke-width="5" fill="#000000">
                    <polygon points="40,5 50,28 75,30 55,48 62,72 40,58 18,72 25,48 5,30 30,28" fill="#000000" stroke="none"/>
                    <line x1="40" y1="80" x2="40" y2="155" stroke-width="6"/>
                    <circle cx="40" cy="165" r="5" fill="#000000"/>
                </g>

                <!-- Tiêu đề chính SIÊU TO, ĐẬM NÉT, ĐẦY HẤP DẪN -->
                <text x="500" y="125" text-anchor="middle" font-family="'mt2-mincap', 'UTM-Colossalis', Impact, 'Arial Black', sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="2" fill="#000000" stroke="#000000" stroke-width="1">${cleanText}</text>
            </svg>
            `;
        }

        // KIỂU 2: TRẮNG ĐEN KHUNG RUY BĂNG / TIA CHỚP GIỜ VÀNG (CỰC SỐC)
        if (theme === "bw_ribbon") {
            return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 180" width="100%" height="100%" preserveAspectRatio="none">
                <rect x="5" y="5" width="990" height="170" fill="#ffffff" stroke="#000000" stroke-width="6"/>
                <!-- Khung viền ruy băng nổi bật -->
                <rect x="22" y="20" width="956" height="140" fill="#ffffff" stroke="#000000" stroke-width="3.5"/>
                <line x1="22" y1="30" x2="978" y2="30" stroke="#000000" stroke-width="2"/>
                <line x1="22" y1="150" x2="978" y2="150" stroke="#000000" stroke-width="2"/>

                <!-- Tia chớp GIÁ SỐC bên trái & phải -->
                <polygon points="45,45 68,45 54,80 78,80 40,128 52,90 32,90" fill="#000000"/>
                <polygon points="935,45 958,45 944,80 968,80 930,128 942,90 922,90" fill="#000000"/>

                <text x="500" y="123" text-anchor="middle" font-family="'mt2-mincap', 'UTM-Colossalis', Impact, 'Arial Black', sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="2.5" fill="#000000" stroke="#000000" stroke-width="1.2">${cleanText}</text>
            </svg>
            `;
        }

        // KIỂU 3: CHỮ 3D ĐỔ BÓNG NÉT (Nổi khối mạnh mẽ, siêu bắt mắt)
        if (theme === "bw_shadow") {
            return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 180" width="100%" height="100%" preserveAspectRatio="none">
                <rect x="5" y="5" width="990" height="170" fill="#ffffff" stroke="#000000" stroke-width="6"/>
                <rect x="15" y="15" width="970" height="150" fill="none" stroke="#000000" stroke-width="1.5" stroke-dasharray="12 6"/>

                <!-- Bóng đổ 3D nét đậm -->
                <text x="505" y="128" text-anchor="middle" font-family="'mt2-mincap', 'UTM-Colossalis', Impact, 'Arial Black', sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="2.5" fill="#94a3b8">${cleanText}</text>
                <!-- Lớp chữ chính cực to -->
                <text x="500" y="123" text-anchor="middle" font-family="'mt2-mincap', 'UTM-Colossalis', Impact, 'Arial Black', sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="2.5" fill="#000000" stroke="#000000" stroke-width="1">${cleanText}</text>
            </svg>
            `;
        }

        // KIỂU 4: NỀN ĐEN CHỮ TRẮNG (Cổ điển siêu thị MWG)
        if (theme === "bw_invert") {
            return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 180" width="100%" height="100%" preserveAspectRatio="none">
                <rect x="0" y="0" width="1000" height="180" fill="#000000"/>
                <rect x="10" y="10" width="980" height="160" fill="none" stroke="#ffffff" stroke-width="4"/>

                <!-- Ngôi sao trắng bên góc -->
                <polygon points="50,30 57,48 76,49 61,63 66,82 50,71 34,82 39,63 24,49 43,48" fill="#ffffff"/>
                <polygon points="950,30 957,48 976,49 961,63 966,82 950,71 934,82 939,63 924,49 943,48" fill="#ffffff"/>

                <text x="500" y="125" text-anchor="middle" font-family="'mt2-mincap', 'UTM-Colossalis', Impact, 'Arial Black', sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="2" fill="#ffffff">${cleanText}</text>
            </svg>
            `;
        }

        // Mặc định trả về kiểu 1
        return BannerGenerator.getBannerSVG(cleanText, "bw_classic");
    }
}
