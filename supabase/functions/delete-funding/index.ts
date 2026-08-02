import { corsHeaders, getSupabaseClients, jsonResponse } from "../_shared/kakaopay.ts";

type DeleteFundingRequest = {
  fundingId?: string;
};

type FundingRecord = {
  id: string;
  creator_id: string;
  current_orders: number;
  image_path: string | null;
  sample_image_path: string | null;
  trademark_screening_id: string | null;
};

const messageFromError = (error: unknown) =>
  error instanceof Error ? error.message : "펀딩을 삭제하지 못했습니다.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user, serviceClient } = await getSupabaseClients(req);
    const body = (await req.json()) as DeleteFundingRequest;

    if (!body.fundingId) {
      return jsonResponse({ error: "삭제할 펀딩을 선택해주세요." }, 400);
    }

    const { data, error: fundingError } = await serviceClient
      .from("fundings")
      .select("id, creator_id, current_orders, image_path, sample_image_path, trademark_screening_id")
      .eq("id", body.fundingId)
      .maybeSingle();
    const funding = data as FundingRecord | null;

    if (fundingError) throw fundingError;
    if (!funding) return jsonResponse({ error: "이미 삭제되었거나 존재하지 않는 펀딩입니다." }, 404);

    const { data: adminResult, error: adminError } = await serviceClient.rpc("is_admin", {
      user_id: user.id,
    });
    if (adminError) throw adminError;

    if (funding.creator_id !== user.id && adminResult !== true) {
      return jsonResponse({ error: "본인이 만든 펀딩만 삭제할 수 있습니다." }, 403);
    }

    const { data: participations, error: participationError } = await serviceClient
      .from("funding_participations")
      .select("id, status, payment_status")
      .eq("funding_id", funding.id);
    if (participationError) throw participationError;

    const hasActiveCommitment = funding.current_orders > 0 || (participations || []).some(
      (participation) =>
        participation.status !== "cancelled" || ["ready", "paid"].includes(participation.payment_status),
    );
    if (hasActiveCommitment) {
      return jsonResponse({
        error: "진행 중이거나 결제가 완료된 참여 내역이 있어 삭제할 수 없습니다. 참여자와 결제 건을 먼저 취소·환불 처리해주세요.",
      }, 409);
    }

    const { error: deleteError } = await serviceClient
      .from("fundings")
      .delete()
      .eq("id", funding.id);
    if (deleteError) throw deleteError;

    const warnings: string[] = [];
    const sampleFolder = `${funding.creator_id}/${funding.id}`;
    const { data: sampleObjects, error: sampleListError } = await serviceClient.storage
      .from("funding-samples")
      .list(sampleFolder, { limit: 1000 });

    if (sampleListError) {
      warnings.push("샘플 이미지 목록을 확인하지 못했습니다.");
    } else {
      const samplePaths = (sampleObjects || [])
        .filter((item) => item.name && item.name !== ".emptyFolderPlaceholder")
        .map((item) => `${sampleFolder}/${item.name}`);
      if (funding.sample_image_path && !samplePaths.includes(funding.sample_image_path)) {
        samplePaths.push(funding.sample_image_path);
      }
      if (samplePaths.length > 0) {
        const { error: sampleRemoveError } = await serviceClient.storage
          .from("funding-samples")
          .remove(samplePaths);
        if (sampleRemoveError) warnings.push("일부 샘플 이미지를 정리하지 못했습니다.");
      }
    }

    if (funding.image_path) {
      const [otherFundingsResult, ordersResult] = await Promise.all([
        serviceClient
          .from("fundings")
          .select("id", { count: "exact", head: true })
          .eq("image_path", funding.image_path),
        serviceClient
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("image_path", funding.image_path)
          .neq("status", "deleted"),
      ]);

      if (otherFundingsResult.error || ordersResult.error) {
        warnings.push("펀딩 이미지는 다른 사용 여부를 확인하지 못해 보존했습니다.");
      } else if ((otherFundingsResult.count || 0) === 0 && (ordersResult.count || 0) === 0) {
        const { error: imageRemoveError } = await serviceClient.storage
          .from("generated_images")
          .remove([funding.image_path]);
        if (imageRemoveError) {
          warnings.push("펀딩 이미지를 정리하지 못했습니다.");
        } else {
          const { error: imageRecordError } = await serviceClient
            .from("generated_images")
            .delete()
            .eq("user_id", funding.creator_id)
            .eq("image_path", funding.image_path);
          if (imageRecordError) warnings.push("펀딩 이미지 기록을 정리하지 못했습니다.");
        }
      }
    }

    if (funding.trademark_screening_id) {
      const { count, error: screeningReferenceError } = await serviceClient
        .from("fundings")
        .select("id", { count: "exact", head: true })
        .eq("trademark_screening_id", funding.trademark_screening_id);
      if (!screeningReferenceError && (count || 0) === 0) {
        const { error: screeningDeleteError } = await serviceClient
          .from("trademark_screenings")
          .delete()
          .eq("id", funding.trademark_screening_id);
        if (screeningDeleteError) warnings.push("상표 분석 기록을 정리하지 못했습니다.");
      }
    }

    return jsonResponse({ success: true, warnings });
  } catch (error) {
    console.error("delete-funding", error);
    return jsonResponse({ error: messageFromError(error) }, 400);
  }
});
