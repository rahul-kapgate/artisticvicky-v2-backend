import { supabase } from "../config/supabaseClient.js";

export const permanentlyDeleteAccount = async (userId) => {
  /*
   * 1. Get user BEFORE deletion.
   *
   * We need email/name for the final email.
   */
  const { data: user, error: userError } = await supabase
    .from("users")
    .select(
      `
      id,
      user_name,
      email,
      is_admin,
      account_status,
      deletion_scheduled_at
    `,
    )
    .eq("id", userId)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  if (user.is_admin) {
    throw new Error("ADMIN_ACCOUNT_CANNOT_BE_DELETED");
  }

  if (user.account_status !== "pending_deletion") {
    throw new Error("ACCOUNT_NOT_PENDING_DELETION");
  }

  if (
    !user.deletion_scheduled_at ||
    new Date(user.deletion_scheduled_at).getTime() > Date.now()
  ) {
    throw new Error("DELETION_PERIOD_NOT_EXPIRED");
  }

  /*
   * Keep these temporarily in memory.
   */
  const email = user.email;
  const name = user.user_name;

  /*
   * 2. Find external artwork files.
   */
  const { data: artwork, error: artworkError } = await supabase
    .from("student_art_work")
    .select(
      `
      id,
      image
    `,
    )
    .eq("created_by", userId);

  if (artworkError) {
    throw artworkError;
  }

  /*
   * 3. Find certificate files.
   */
  const { data: certificates, error: certificateError } = await supabase
    .from("certificates")
    .select(
      `
      id,
      file_name
    `,
    )
    .eq("user_id", userId);

  if (certificateError) {
    throw certificateError;
  }

  /*
   * 4. Delete external files.
   *
   * We'll plug in your actual storage
   * provider here.
   */

  for (const item of artwork ?? []) {
    if (!item.image) {
      continue;
    }

    // await deleteArtworkFile(item.image);
  }

  for (const certificate of certificates ?? []) {
    if (!certificate.file_name) {
      continue;
    }

    // await deleteCertificateFile(
    //   certificate.file_name
    // );
  }

  /*
   * 5. Run atomic DB cleanup.
   */
  const { data, error: deletionError } = await supabase.rpc(
    "finalize_user_deletion",
    {
      p_user_id: userId,
    },
  );

  if (deletionError) {
    throw deletionError;
  }

  return {
    success: true,

    deletedUserId: userId,

    /*
     * Only returned temporarily so calling
     * service can send final email.
     */
    email,
    name,

    databaseResult: data,
  };
};
