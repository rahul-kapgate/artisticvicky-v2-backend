import { supabase } from "../config/supabaseClient.js";

const REVIEW_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const isValidRating = (rating) => {
  const value = Number(rating);
  return Number.isInteger(value) && value >= 1 && value <= 5;
};

const isUserEnrolledInCourse = (course, userId) => {
  if (!Array.isArray(course?.students_enrolled)) return false;
  return course.students_enrolled.map(Number).includes(Number(userId));
};

const getCourseByIdInternal = async (courseId) => {
  const { data, error } = await supabase
    .from("courses")
    .select("id, course_name, students_enrolled, rating")
    .eq("id", courseId)
    .single();

  if (error) throw error;
  return data;
};

const getReviewByIdInternal = async (reviewId) => {
  const { data, error } = await supabase
    .from("course_reviews")
    .select("*")
    .eq("id", reviewId)
    .single();

  if (error) throw error;
  return data;
};

const enrichReviews = async (reviews = [], includeCourse = false) => {
  if (!reviews.length) return [];

  const userIds = [...new Set(reviews.map((r) => r.user_id).filter(Boolean))];
  const courseIds = [...new Set(reviews.map((r) => r.course_id).filter(Boolean))];

  let users = [];
  let courses = [];

  if (userIds.length) {
    const { data, error } = await supabase
      .from("users")
      .select("id, user_name, email, mobile")
      .in("id", userIds);

    if (error) throw error;
    users = data || [];
  }

  if (includeCourse && courseIds.length) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, course_name")
      .in("id", courseIds);

    if (error) throw error;
    courses = data || [];
  }

  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});

  const courseMap = courses.reduce((acc, course) => {
    acc[course.id] = course;
    return acc;
  }, {});

  return reviews.map((review) => ({
    ...review,
    user: userMap[review.user_id] || null,
    course: includeCourse ? courseMap[review.course_id] || null : undefined,
  }));
};

const recalculateCourseRating = async (courseId) => {
  const { data: approvedReviews, error } = await supabase
    .from("course_reviews")
    .select("rating")
    .eq("course_id", courseId)
    .eq("status", REVIEW_STATUS.APPROVED);

  if (error) throw error;

  const ratings = approvedReviews || [];
  const average =
    ratings.length > 0
      ? Number(
          (
            ratings.reduce((sum, item) => sum + Number(item.rating || 0), 0) /
            ratings.length
          ).toFixed(1)
        )
      : 0;

  const { error: updateError } = await supabase
    .from("courses")
    .update({
      rating: average,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (updateError) throw updateError;
};

export const createCourseReview = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const { courseId, rating, review_text } = req.body;

    if (!courseId || rating === undefined) {
      return res.status(400).json({
        success: false,
        message: "courseId and rating are required",
      });
    }

    if (!isValidRating(rating)) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5",
      });
    }

    const parsedCourseId = Number(courseId);
    const course = await getCourseByIdInternal(parsedCourseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (!isUserEnrolledInCourse(course, userId)) {
      return res.status(403).json({
        success: false,
        message: "Only enrolled students can submit a review",
      });
    }

    const { data: existingReview, error: existingError } = await supabase
      .from("course_reviews")
      .select("id")
      .eq("course_id", parsedCourseId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "You have already submitted a review for this course",
      });
    }

    const payload = {
      course_id: parsedCourseId,
      user_id: userId,
      rating: Number(rating),
      review_text: review_text?.trim() || null,
      status: REVIEW_STATUS.PENDING,
    };

    const { data, error } = await supabase
      .from("course_reviews")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully and is pending admin approval",
      data,
    });
  } catch (error) {
    console.error("Create course review error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating review",
      error: error.message,
    });
  }
};

export const getCourseReviewsByCourse = async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Valid courseId is required",
      });
    }

    const { data: reviews, error } = await supabase
      .from("course_reviews")
      .select("*")
      .eq("course_id", courseId)
      .eq("status", REVIEW_STATUS.APPROVED)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const enrichedReviews = await enrichReviews(reviews || []);

    return res.status(200).json({
      success: true,
      message: "Course reviews fetched successfully",
      count: enrichedReviews.length,
      data: enrichedReviews,
    });
  } catch (error) {
    console.error("Get course reviews error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching reviews",
      error: error.message,
    });
  }
};

export const updateCourseReview = async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    const userId = Number(req.user?.id);
    const { rating, review_text } = req.body;

    if (!reviewId) {
      return res.status(400).json({
        success: false,
        message: "Valid review id is required",
      });
    }

    if (rating === undefined && review_text === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    if (rating !== undefined && !isValidRating(rating)) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5",
      });
    }

    const existingReview = await getReviewByIdInternal(reviewId);

    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (Number(existingReview.user_id) !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can update only your own review",
      });
    }

    const updates = {
      updated_at: new Date().toISOString(),
      status: REVIEW_STATUS.PENDING,
    };

    if (rating !== undefined) {
      updates.rating = Number(rating);
    }

    if (review_text !== undefined) {
      updates.review_text = review_text?.trim() || null;
    }

    const wasApproved = existingReview.status === REVIEW_STATUS.APPROVED;

    const { data, error } = await supabase
      .from("course_reviews")
      .update(updates)
      .eq("id", reviewId)
      .select("*")
      .single();

    if (error) throw error;

    if (wasApproved) {
      await recalculateCourseRating(existingReview.course_id);
    }

    return res.status(200).json({
      success: true,
      message: "Review updated successfully and sent for admin approval again",
      data,
    });
  } catch (error) {
    console.error("Update course review error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating review",
      error: error.message,
    });
  }
};

export const deleteCourseReview = async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    const userId = Number(req.user?.id);

    if (!reviewId) {
      return res.status(400).json({
        success: false,
        message: "Valid review id is required",
      });
    }

    const existingReview = await getReviewByIdInternal(reviewId);

    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (Number(existingReview.user_id) !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can delete only your own review",
      });
    }

    const wasApproved = existingReview.status === REVIEW_STATUS.APPROVED;

    const { error } = await supabase
      .from("course_reviews")
      .delete()
      .eq("id", reviewId);

    if (error) throw error;

    if (wasApproved) {
      await recalculateCourseRating(existingReview.course_id);
    }

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete course review error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while deleting review",
      error: error.message,
    });
  }
};

export const getPendingCourseReviews = async (req, res) => {
  try {
    const { data: reviews, error } = await supabase
      .from("course_reviews")
      .select("*")
      .eq("status", REVIEW_STATUS.PENDING)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const enrichedReviews = await enrichReviews(reviews || [], true);

    return res.status(200).json({
      success: true,
      message: "Pending course reviews fetched successfully",
      count: enrichedReviews.length,
      data: enrichedReviews,
    });
  } catch (error) {
    console.error("Get pending course reviews error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching pending reviews",
      error: error.message,
    });
  }
};

export const approveCourseReview = async (req, res) => {
  try {
    const reviewId = Number(req.params.id);

    if (!reviewId) {
      return res.status(400).json({
        success: false,
        message: "Valid review id is required",
      });
    }

    const review = await getReviewByIdInternal(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    const previousStatus = review.status;

    const { data, error } = await supabase
      .from("course_reviews")
      .update({
        status: REVIEW_STATUS.APPROVED,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .select("*")
      .single();

    if (error) throw error;

    if (previousStatus !== REVIEW_STATUS.APPROVED) {
      await recalculateCourseRating(review.course_id);
    }

    return res.status(200).json({
      success: true,
      message: "Review approved successfully",
      data,
    });
  } catch (error) {
    console.error("Approve course review error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while approving review",
      error: error.message,
    });
  }
};

export const rejectCourseReview = async (req, res) => {
  try {
    const reviewId = Number(req.params.id);

    if (!reviewId) {
      return res.status(400).json({
        success: false,
        message: "Valid review id is required",
      });
    }

    const review = await getReviewByIdInternal(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    const previousStatus = review.status;

    const { data, error } = await supabase
      .from("course_reviews")
      .update({
        status: REVIEW_STATUS.REJECTED,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .select("*")
      .single();

    if (error) throw error;

    if (previousStatus === REVIEW_STATUS.APPROVED) {
      await recalculateCourseRating(review.course_id);
    }

    return res.status(200).json({
      success: true,
      message: "Review rejected successfully",
      data,
    });
  } catch (error) {
    console.error("Reject course review error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while rejecting review",
      error: error.message,
    });
  }
};

export const getMyCourseReviewStatus = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const courseId = Number(req.params.courseId);

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Valid courseId is required",
      });
    }

    // 1) check course exists + enrollment
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, students_enrolled")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const enrolled =
      Array.isArray(course.students_enrolled) &&
      course.students_enrolled.map(Number).includes(userId);

    // 2) get student's review for this course
    const { data: review, error: reviewError } = await supabase
      .from("course_reviews")
      .select("*")
      .eq("course_id", courseId)
      .eq("user_id", userId)
      .maybeSingle();

    if (reviewError) {
      throw reviewError;
    }

    return res.status(200).json({
      success: true,
      message: "Review status fetched successfully",
      data: {
        canReview: enrolled,
        hasReviewed: !!review,
        status: review?.status || null,
        review: review || null,
      },
    });
  } catch (error) {
    console.error("Get my course review status error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching review status",
      error: error.message,
    });
  }
};

export const getAdminCourseReviews = async (req, res) => {
  try {
    const status = String(req.query.status || "pending").toLowerCase();

    let query = supabase
      .from("course_reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: reviews, error } = await query;

    if (error) throw error;

    const enrichedReviews = await enrichReviews(reviews || [], true);

    return res.status(200).json({
      success: true,
      message: "Course reviews fetched successfully",
      count: enrichedReviews.length,
      data: enrichedReviews,
    });
  } catch (error) {
    console.error("Get admin course reviews error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching course reviews",
      error: error.message,
    });
  }
};