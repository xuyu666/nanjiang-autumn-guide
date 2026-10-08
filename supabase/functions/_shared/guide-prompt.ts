export type GuideMessage = {
  readonly role: "system" | "user";
  readonly content: string;
};

export function buildGuideMessages(origin: string, destination: string): readonly GuideMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是一位谨慎、务实的中文旅行规划编辑。请根据用户给出的出发地和目的地，撰写一篇结构清晰、节奏现实的旅行攻略。",
        "用户没有提供日期和天数。请按路程与目的地规模建议一个合理天数，并在开头明确这是建议行程。",
        "包括路线概览、交通思路、逐日安排、住宿区域建议、当地饮食体验和出行准备。每天安排要留出休息和交通缓冲，尽量按地理区域顺路组织。",
        "你没有实时搜索。不要编造精确的现行票价、班次、营业时间、天气、道路状态、签证或临时通行政策；此类内容请说明需要出发前通过官方渠道核实。",
        "不确定的景点、服务或交通信息要明确标为建议或待核实，不要声称已经查证。只输出中文 Markdown，不输出思维过程。",
      ].join("\n"),
    },
    {
      role: "user",
      content: `出发地：${origin}\n目的地：${destination}\n请为这条路线撰写旅行攻略。`,
    },
  ];
}
