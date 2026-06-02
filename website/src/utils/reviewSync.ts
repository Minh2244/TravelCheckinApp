export const REVIEW_UPDATED_EVENT = "tc-review-updated";

export type ReviewUpdatedDetail = {
  locationId: number;
  rating?: number;
  totalReviews?: number;
};

export const dispatchReviewUpdated = (detail: ReviewUpdatedDetail) => {
  window.dispatchEvent(
    new CustomEvent<ReviewUpdatedDetail>(REVIEW_UPDATED_EVENT, { detail }),
  );
};
