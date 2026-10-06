import { NO_TOXIC_DATA, custom, leafSpot, lowLight, ncsu, pests, powderyMildew, rootRot, sunburn, type PlantProfile } from "./types.js";

const SUCCULENT_SOIL = "Đất chuyên cho sen đá, xương rồng: nhiều đá nhỏ, cát, thoát nước thật nhanh; chậu phải có lỗ thoát nước.";

const succulentRot = (signs: string, why?: string) =>
  rootRot({
    signs,
    dry: "đất khô hẳn cả chậu",
    why:
      why ??
      "Cây mọng nước trữ nước trong lá và thân nên rất sợ đất ẩm lâu. Tưới thường xuyên hoặc đất giữ nước làm gốc thối, lá nhũn trong suốt rồi rụng.",
    extraSteps: ["Gỡ bỏ lá nhũn, trong suốt. Lá còn lành có thể để khô vài ngày rồi đặt lên đất khô để giâm."],
    severity: "nang",
  });

const etiolation = (signs: string) =>
  lowLight({
    signs,
    light: "chỗ có nắng sáng như bậu cửa sổ hoặc ban công, cho làm quen nắng từ từ",
    why: "Thiếu sáng, cây vươn dài tìm ánh sáng nên thân dài ra, lá thưa, mỏng và mất màu. Phần đã vươn không co lại được.",
    extraSteps: ["Phần thân đã vươn dài không co lại được: có thể cắt ngọn để vài ngày cho khô vết cắt rồi giâm lại thành cây gọn."],
  });

const mealybugs = () => pests({ kinds: ["rep_sap"], noWash: true, extraSteps: ["Ở kẽ lá sâu, dùng tăm bông chấm cồn y tế lau rệp."] });

export const SUCCULENTS: PlantProfile[] = [
  {
    id: "sen_da",
    nameVi: "Sen đá",
    aliases: ["sen đá", "sen đá hồng", "sen vỉ", "sen mông", "sen trung", "sen dola", "dola", "ngọc bích", "echeveria", "succulent"],
    scientific: "Echeveria, Graptopetalum, Sedum, Crassula…",
    match: {
      genera: ["Echeveria", "Graptopetalum", "Graptoveria", "Sedum", "Pachyphytum", "Crassula", "Aeonium", "Graptosedum"],
      families: ["Crassulaceae"],
    },
    group: "sen_da_xuong_rong",
    basics: {
      lightLevel: "nang",
      light: "Ưa nắng, chịu được nắng trực tiếp; càng nhiều nắng lá càng lên màu đẹp. Trong nhà để bậu cửa sổ thật sáng.",
      water: "Cần rất ít nước: chỉ tưới khi đất khô hẳn.",
      soil: SUCCULENT_SOIL,
      toxic: NO_TOXIC_DATA,
      note: "Lá dưới cùng héo khô rồi rụng dần là bình thường khi cây lớn. Cây con mọc quanh gốc có thể tách ra trồng riêng.",
    },
    alohaDoc: null,
    problems: [
      succulentRot("Lá dưới mọng, trong suốt như bị luộc rồi rụng; gốc thân thâm đen, mềm; đất ẩm."),
      etiolation("Thân vươn cao, khoảng cách giữa các lá thưa ra, lá duỗi thẳng xuống thay vì ôm tròn, màu nhạt xanh."),
      custom({
        id: "la_kho_duoi",
        condition: "la_gia",
        title: "Lá dưới cùng teo khô tự nhiên",
        signs: "Vài lá dưới cùng sát đất teo lại, khô mỏng như giấy, phần ngọn vẫn căng mọng.",
        summary: "Đây là lá già tự teo khi cây lớn, không phải bệnh.",
        why: "Sen đá rút dần nước và dinh dưỡng từ lá già dưới cùng để nuôi lá mới.",
        steps: ["Gỡ nhẹ các lá đã khô hẳn để gốc thông thoáng, tránh nấm và rệp ẩn nấp."],
        care: ["Nếu cả cây đều nhăn, mềm thì mới là thiếu nước: tưới đẫm khi đất khô hẳn."],
        severity: "nhe",
      }),
    ],
    source: ncsu("echeveria", "Echeveria"),
    reviewed: false,
  },
  {
    id: "haworthia",
    nameVi: "Sen đá Haworthia / Móng rồng",
    aliases: ["haworthia", "móng rồng", "sen đá haworthia"],
    scientific: "Haworthia, Haworthiopsis",
    match: { genera: ["Haworthia", "Haworthiopsis", "Tulista", "Gasteria"] },
    group: "sen_da_xuong_rong",
    basics: {
      lightLevel: "sang_manh",
      light: "Nắng hoặc ánh sáng tán xạ sáng để lá lên màu đẹp; chịu được chỗ ít sáng hơn.",
      water: "Để đất khô hẳn giữa hai lần tưới; cây chịu hạn tốt.",
      soil: SUCCULENT_SOIL,
      toxic: NO_TOXIC_DATA,
      note: "Không chịu sương giá, lạnh. Cây nhỏ, chậm lớn, hợp để bàn làm việc hoặc tiểu cảnh.",
    },
    alohaDoc: null,
    problems: [
      succulentRot("Lá mềm nhũn, trong suốt hoặc thâm đen từ gốc; cây lung lay, đất ẩm."),
      mealybugs(),
      lowLight({
        signs: "Lá nhạt màu, mỏng, mọc thưa và vươn dài hơn bình thường.",
        light: "chỗ có nắng hoặc ánh sáng tán xạ sáng",
        why: "Haworthia sống được ở chỗ ít sáng nhưng chỉ lên màu đẹp, lá chắc khi đủ sáng.",
      }),
    ],
    source: ncsu("haworthia", "Haworthia"),
    reviewed: false,
  },
  {
    id: "xuong_rong",
    nameVi: "Xương rồng",
    aliases: ["xương rồng", "xương rồng tai thỏ", "thanh sơn", "kim hổ", "trứng chim", "bánh sinh nhật", "xương rồng màu", "gym", "cactus"],
    scientific: "Họ Xương rồng (Cactaceae)",
    match: { families: ["Cactaceae"] },
    group: "sen_da_xuong_rong",
    basics: {
      lightLevel: "sang_manh",
      light: "Đặt gần cửa sổ, nơi có ánh sáng tự nhiên ít nhất 3–4 tiếng mỗi ngày; mỗi tuần cho phơi nắng nhẹ buổi sáng (7–9h) 2–3 lần để cây giữ dáng và màu.",
      water: "Chỉ tưới khi đất đã khô hoàn toàn, trung bình 7–10 ngày/lần; tưới nhẹ sát thành chậu, tránh tưới lên thân và ngọn.",
      soil: "Đất chuyên cho xương rồng trộn thêm sỏi nhỏ hoặc cát thô cho thoát nước thật nhanh; chậu có lỗ thoát nước.",
      toxic: "Không độc với người và thú cưng, nhưng gai nhọn có thể gây thương tích; để xa tầm với trẻ nhỏ.",
      note: "Vệ sinh bụi bằng cọ mềm hoặc xịt hơi sương nhẹ, không lau bằng khăn.",
    },
    alohaDoc: "Xương Rồng Mini, Thỏ Ngọc Cung Trăng",
    problems: [
      succulentRot(
        "Gốc thân mềm, thâm nâu hoặc đen, có thể chảy nước; thân xẹp, lung lay; đất ẩm.",
        "Xương rồng trữ nước trong thân nên rất sợ úng. Tưới nhiều hoặc chỗ đặt bí gió làm nấm, vi khuẩn gây thối gốc lan nhanh từ dưới lên."
      ),
      mealybugs(),
      pests({ kinds: ["nhen_do", "rep_vay"], noWash: true }),
    ],
    source: ncsu("mammillaria", "Mammillaria"),
    reviewed: false,
  },
  {
    id: "song_doi",
    nameVi: "Sống đời (Kalanchoe)",
    aliases: ["sống đời", "trường thọ", "cây bỏng", "kalanchoe"],
    scientific: "Kalanchoe blossfeldiana và các loài Kalanchoe",
    match: { genera: ["Kalanchoe"] },
    group: "sen_da_xuong_rong",
    basics: {
      lightLevel: "sang_manh",
      light: "Ánh sáng tán xạ sáng hoặc nắng một phần; che nắng buổi chiều vì nắng gắt lâu làm cháy lá. Cần 6–8 giờ sáng mỗi ngày để ra hoa.",
      water: "Để đất khô hẳn rồi tưới đẫm một lần.",
      soil: "Đất thoát nước tốt, loại dành cho sen đá, xương rồng.",
      toxic: "Độc mức trung bình: ăn phải có thể buồn nôn, nôn, tiêu chảy, rối loạn nhịp tim; với chó mèo có thể gây tử vong. Để xa trẻ nhỏ và thú cưng.",
      note: "Cắt bỏ hoa tàn để cây ra thêm hoa. Muốn ra đợt hoa mới, cây cần khoảng 6 tuần mỗi đêm 14 giờ tối hoàn toàn.",
    },
    alohaDoc: null,
    problems: [
      succulentRot("Gốc thân thâm mềm, lá dưới vàng nhũn, cây gục; đất ẩm lâu."),
      pests({ kinds: ["rep", "rep_sap", "nhen_do"] }),
      powderyMildew({ signs: "Mặt lá có lớp bột trắng như phấn hoặc mảng nâu loang; cây để chỗ bí gió." }),
      custom({
        id: "khong_hoa",
        condition: "khac",
        title: "Không ra hoa lại",
        signs: "Cây xanh tốt, lá mọng nhưng hết đợt hoa đầu thì không ra hoa nữa.",
        summary: "Sống đời cần đêm dài tối hoàn toàn mới tạo nụ. Cho cây đủ đêm tối khoảng 6 tuần là ra hoa lại.",
        why: "Sống đời chỉ tạo nụ khi mỗi đêm có khoảng 14 giờ tối hoàn toàn liên tục; cây để chỗ có đèn ban đêm sẽ không ra hoa.",
        steps: [
          "Mỗi ngày để cây chỗ tối hoàn toàn khoảng 14 giờ (có thể trùm hộp giấy hoặc để trong tủ), ban ngày đưa ra chỗ sáng.",
          "Làm liên tục khoảng 6 tuần cho tới khi thấy nụ.",
          "Trong thời gian này tưới ít, không bón phân.",
        ],
        care: ["Cây cần 6–8 giờ sáng mỗi ngày để có sức ra hoa.", "Cắt bỏ hoa tàn sau mỗi đợt."],
        severity: "nhe",
      }),
      sunburn({
        signs: "Lá có mảng đỏ nâu hoặc nâu khô ở mặt hướng nắng, sau khi để nắng gắt buổi chiều.",
        light: "Đặt chỗ sáng hoặc nắng buổi sáng, che nắng buổi chiều.",
      }),
    ],
    source: ncsu("kalanchoe-blossfeldiana", "Kalanchoe blossfeldiana"),
    reviewed: false,
  },
  {
    id: "bat_tien",
    nameVi: "Bát tiên",
    aliases: ["bát tiên", "xương rồng bát tiên", "hoa bát tiên", "euphorbia milii"],
    scientific: "Euphorbia milii",
    match: { species: ["Euphorbia milii"] },
    group: "sen_da_xuong_rong",
    basics: {
      lightLevel: "nang",
      light: "Cần nắng đầy đủ; trong nhà đặt chỗ thật nhiều sáng.",
      water: "Để đất khô tới hơi ẩm; không để đất ướt, nhất là khi trời lạnh.",
      soil: "Đất thoát nước tốt.",
      toxic: "Nhựa trắng gây viêm da, dính vào mắt có thể tổn thương mắt; ăn phải gây phồng rộp miệng. Thân có gai. Đeo găng khi cắt tỉa, để xa trẻ nhỏ và thú cưng.",
      note: "Cây có thể rụng lá theo chu kỳ trước khi nghỉ, sau đó sẽ ra lá lại.",
    },
    alohaDoc: null,
    problems: [
      custom({
        id: "rung_la",
        condition: "khac",
        title: "Rụng lá theo chu kỳ",
        signs: "Lá vàng rồi rụng dần, thân vẫn chắc, không mềm, không thâm; đất không sũng nước.",
        summary: "Bát tiên có thể rụng lá theo chu kỳ trước khi nghỉ. Thân còn chắc là cây vẫn khoẻ và sẽ ra lá lại.",
        why: "Bát tiên tự rụng bớt lá theo chu kỳ trước giai đoạn nghỉ; đây là bình thường nếu thân vẫn chắc.",
        steps: [
          "Bóp nhẹ thân: thân chắc là cây đang nghỉ; thân mềm, thâm là thối (xem mục úng rễ).",
          "Giảm tưới, để đất khô bớt; giữ cây chỗ nhiều nắng.",
          "Đeo găng khi gỡ lá, cắt cành vì nhựa gây bỏng rát.",
        ],
        care: ["Giữ chỗ nắng ổn định; tưới lại bình thường khi thấy lá mới nhú."],
        severity: "nhe",
      }),
      rootRot({
        signs: "Gốc thân thâm đen, mềm; lá vàng rụng; đất ẩm lâu.",
        dry: "đất đã khô bớt",
        extraSteps: ["Đeo găng tay khi xử lý vì nhựa cây gây bỏng rát."],
        severity: "nang",
      }),
      leafSpot({ signs: "Lá có đốm nâu hoặc đen, có thể có mốc xám; lá bệnh vàng rồi rụng." }),
      pests({ kinds: ["rep_vay", "rep_sap", "bo_tri", "nhen_do"], extraSteps: ["Đeo găng tay khi lau rệp vì nhựa gây bỏng rát."] }),
    ],
    source: ncsu("euphorbia-milii", "Euphorbia milii"),
    reviewed: false,
  },
  {
    id: "nha_dam",
    nameVi: "Nha đam",
    aliases: ["nha đam", "lô hội", "nha đam kiểng", "aloe"],
    scientific: "Aloe vera và các loài Aloe",
    match: { genera: ["Aloe"] },
    group: "sen_da_xuong_rong",
    basics: {
      lightLevel: "sang_manh",
      light: "Nắng đầy đủ tới nắng một phần trong ngày.",
      water: "Để đất khô hoàn toàn rồi mới tưới; trời lạnh tưới thưa hơn.",
      soil: "Đất thật thoát nước (đất sen đá, xương rồng); chậu có lỗ thoát nước, chậu đất nung là tốt nhất.",
      toxic: "Độc nhẹ khi ăn phải: đau bụng, tiêu chảy; nhựa vàng ở vỏ lá có thể gây ngứa da. Để xa trẻ nhỏ và thú cưng.",
      note: "Gel trong lá bôi ngoài da an toàn với đa số người; không ăn phần vỏ lá.",
    },
    alohaDoc: null,
    problems: [
      succulentRot("Lá mềm nhũn, trong suốt hoặc nâu từ gốc; cây lung lay; đất ẩm."),
      pests({ kinds: ["rep_sap", "rep", "rep_vay"], noWash: true }),
      leafSpot({ signs: "Lá có đốm nâu, đen hoặc nốt gỉ sắt màu cam nâu, lan dần." }),
    ],
    source: ncsu("aloe-vera", "Aloe vera"),
    reviewed: false,
  },
];
