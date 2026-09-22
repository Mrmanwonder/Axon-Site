const closed = new URLSearchParams(location.search).get("scenario") === "closed";

export function useScan() {
  return {
    reviewOpen: !closed,
    closeReview() {},
    review: {
      title: "Review paper",
      outstanding: 1,
      cleanCount: 0,
      saveLabel: "1 left to check",
      questions: [{
        id: "question", label: "Question 1", tier: "unsure", confirmed: false,
        marksAwarded: 1, marksAvailable: 2, answer: "x + 1", alternatives: [0, 1, 2],
      }],
    },
    reviewHandlers: {
      onMark(_id: string, value: number) { (window as typeof window & { __markChoice?: number }).__markChoice = value; },
      onAction() {}, onConfirmClean() {}, onSave() {},
    },
  };
}
