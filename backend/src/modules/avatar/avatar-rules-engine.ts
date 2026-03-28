export type AvatarStage = "stage1" | "stage2" | "stage3";

type Rule = {
  stage: AvatarStage;
  minScore: number;
};

const rules: Rule[] = [
  { stage: "stage1", minScore: 0 },
  { stage: "stage2", minScore: 100 },
  { stage: "stage3", minScore: 250 }
];

export const resolveAvatarStage = (totalScore: number): AvatarStage => {
  const matched = [...rules]
    .sort((a, b) => b.minScore - a.minScore)
    .find((rule) => totalScore >= rule.minScore);
  return matched?.stage ?? "stage1";
};
