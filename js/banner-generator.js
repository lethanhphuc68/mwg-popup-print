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
     * Tạo SVG banner độ phân giải vector chuẩn in ấn (Dù bật hay tắt 'Đồ họa nền' vẫn in ra 100%)
     */
    static getBannerSVG(text = "GIÁ RẺ QUÁ", theme = "bw_classic") {
        const cleanText = (text || "GIÁ RẺ QUÁ").trim().toUpperCase();
        
        // Tính toán kích thước font tự động để chữ không bị tràn viền
        let fontSize = 110;
        const textLen = cleanText.length;
        if (textLen > 18) {
            fontSize = 72;
        } else if (textLen > 14) {
            fontSize = 82;
        } else if (textLen > 11) {
            fontSize = 92;
        } else if (textLen > 8) {
            fontSize = 102;
        }

        // KIỂU 1: TRẮNG ĐEN CHUẨN SIÊU THỊ (Khuyên dùng - Nền trắng, Chữ đen đậm, Viền đôi, Hộp quà line-art)
        if (theme === "bw_classic") {
            return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 200" width="100%" height="100%" preserveAspectRatio="none">
                <!-- Viền ngoài dày -->
                <rect x="5" y="5" width="990" height="190" fill="#ffffff" stroke="#000000" stroke-width="6"/>
                <!-- Viền trong mảnh sang trọng -->
                <rect x="14" y="14" width="972" height="172" fill="none" stroke="#000000" stroke-width="2"/>
                
                <!-- Hộp quà bên trái (Line Art đen trắng siêu nét) -->
                <g transform="translate(35, 30) scale(0.7)" stroke="#000000" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="25" y="65" width="115" height="95" fill="#ffffff"/>
                    <rect x="15" y="42" width="135" height="25" fill="#ffffff"/>
                    <line x1="82" y1="42" x2="82" y2="160" stroke-width="8"/>
                    <path d="M82 42 C60 12, 20 22, 50 42 Z" fill="#000000"/>
                    <path d="M82 42 C104 12, 144 22, 114 42 Z" fill="#000000"/>
                    <!-- Ngôi sao ưu đãi -->
                    <polygon points="160,25 163,33 171,33 165,38 167,46 160,41 153,46 155,38 149,33 157,33" fill="#000000" stroke="none"/>
                    <polygon points="12,18 14,24 20,24 15,28 17,34 12,30 7,34 9,28 4,24 10,24" fill="#000000" stroke="none"/>
                </g>

                <!-- Hộp quà bên phải -->
                <g transform="translate(835, 30) scale(0.7)" stroke="#000000" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="25" y="65" width="115" height="95" fill="#ffffff"/>
                    <rect x="15" y="42" width="135" height="25" fill="#ffffff"/>
                    <line x1="82" y1="42" x2="82" y2="160" stroke-width="8"/>
                    <path d="M82 42 C60 12, 20 22, 50 42 Z" fill="#000000"/>
                    <path d="M82 42 C104 12, 144 22, 114 42 Z" fill="#000000"/>
                    <polygon points="160,25 163,33 171,33 165,38 167,46 160,41 153,46 155,38 149,33 157,33" fill="#000000" stroke="none"/>
                    <polygon points="12,18 14,24 20,24 15,28 17,34 12,30 7,34 9,28 4,24 10,24" fill="#000000" stroke="none"/>
                </g>

                <!-- Tiêu đề chính đen đậm siêu nét -->
                <text x="500" y="132" text-anchor="middle" font-family="'mt2-mincap', 'UTM-Colossalis', Impact, sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="1.5" fill="#000000">${cleanText}</text>
            </svg>
            `;
        }

        // KIỂU 2: TRẮNG ĐEN KHUNG RUY BĂNG / TIA CHỚP GIỜ VÀNG
        if (theme === "bw_ribbon") {
            return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 200" width="100%" height="100%" preserveAspectRatio="none">
                <rect x="6" y="6" width="988" height="188" fill="#ffffff" stroke="#000000" stroke-width="5"/>
                <!-- Dải ruy băng viền kép ở giữa -->
                <rect x="30" y="25" width="940" height="150" fill="#ffffff" stroke="#000000" stroke-width="4"/>
                <line x1="30" y1="35" x2="970" y2="35" stroke="#000000" stroke-width="2"/>
                <line x1="30" y1="165" x2="970" y2="165" stroke="#000000" stroke-width="2"/>

                <!-- Biểu tượng tia chớp giá sốc bên trái & phải -->
                <polygon points="70,55 95,55 80,95 105,95 65,145 78,105 55,105" fill="#000000"/>
                <polygon points="905,55 930,55 915,95 940,95 900,145 913,105 890,105" fill="#000000"/>

                <text x="500" y="130" text-anchor="middle" font-family="'mt2-mincap', 'UTM-Colossalis', Impact, sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="2" fill="#000000">${cleanText}</text>
            </svg>
            `;
        }

        // KIỂU 3: CHỮ 3D ĐỔ BÓNG NÉT (Nền trắng, chữ có bóng đen tạo chiều sâu mà không tốn mực)
        if (theme === "bw_shadow") {
            return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 200" width="100%" height="100%" preserveAspectRatio="none">
                <rect x="6" y="6" width="988" height="188" fill="#ffffff" stroke="#000000" stroke-width="6"/>
                <rect x="18" y="18" width="964" height="164" fill="none" stroke="#000000" stroke-width="1.5" stroke-dasharray="10 5"/>

                <!-- Bóng chữ 3D -->
                <text x="504" y="136" text-anchor="middle" font-family="'mt2-mincap', 'UTM-Colossalis', Impact, sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="2" fill="#888888">${cleanText}</text>
                <!-- Chữ chính màu đen -->
                <text x="500" y="132" text-anchor="middle" font-family="'mt2-mincap', 'UTM-Colossalis', Impact, sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="2" fill="#000000">${cleanText}</text>
            </svg>
            `;
        }

        // KIỂU 4: NỀN ĐEN CHỮ TRẮNG (Kiểu mientay2 gốc cho ai muốn nền đen)
        if (theme === "bw_invert") {
            return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 200" width="100%" height="100%" preserveAspectRatio="none">
                <rect x="0" y="0" width="1000" height="200" fill="#000000"/>
                <rect x="10" y="10" width="980" height="180" fill="none" stroke="#ffffff" stroke-width="4"/>

                <!-- Hộp quà màu trắng đảo ngược -->
                <g transform="translate(35, 30) scale(0.7)" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="25" y="65" width="115" height="95" fill="#000000"/>
                    <rect x="15" y="42" width="135" height="25" fill="#000000"/>
                    <line x1="82" y1="42" x2="82" y2="160" stroke-width="8"/>
                    <path d="M82 42 C60 12, 20 22, 50 42 Z" fill="#ffffff"/>
                    <path d="M82 42 C104 12, 144 22, 114 42 Z" fill="#ffffff"/>
                </g>

                <g transform="translate(835, 30) scale(0.7)" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="25" y="65" width="115" height="95" fill="#000000"/>
                    <rect x="15" y="42" width="135" height="25" fill="#000000"/>
                    <line x1="82" y1="42" x2="82" y2="160" stroke-width="8"/>
                    <path d="M82 42 C60 12, 20 22, 50 42 Z" fill="#ffffff"/>
                    <path d="M82 42 C104 12, 144 22, 114 42 Z" fill="#ffffff"/>
                </g>

                <text x="500" y="132" text-anchor="middle" font-family="'mt2-mincap', 'UTM-Colossalis', Impact, sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="2" fill="#ffffff">${cleanText}</text>
            </svg>
            `;
        }

        // Mặc định trả về kiểu 1
        return BannerGenerator.getBannerSVG(cleanText, "bw_classic");
    }
}
