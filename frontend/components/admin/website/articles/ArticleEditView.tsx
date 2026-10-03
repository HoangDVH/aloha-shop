"use client";

import React from "react";
import { ArticleImageCropDialog } from "./ArticleImageCropDialog";
import { ArticleSaveBar } from "./ArticleSaveBar";
import { BasicInfoSection } from "./form/BasicInfoSection";
import { CoverSection } from "./form/CoverSection";
import { VideoSection } from "./form/VideoSection";
import { SummaryContentSection } from "./form/SummaryContentSection";
import { ProductsPublishSection } from "./form/ProductsPublishSection";
import type { FormState } from "./articleUtils";
import type { normalizeVideoInput } from "./articleMediaUtils";

export function ArticleEditView({
  editing,
  patchEditing,
  dirty,
  mediaBusy,
  saving,
  closeEdit,
  save,
  slugManual,
  setSlugManual,
  categories,
  coverRef,
  coverBusy,
  onCoverFile,
  coverCropSrc,
  setCoverCropSrc,
  applyCoverCrop,
  videoFileRef,
  videoBusy,
  onVideoFile,
  videoNorm,
  videoPreviewSrc,
  setEditorBusy,
  addProduct,
}: {
  editing: FormState;
  patchEditing: (next: FormState) => void;
  dirty: boolean;
  mediaBusy: boolean;
  saving: boolean;
  closeEdit: () => void;
  save: () => Promise<void> | void;
  slugManual: boolean;
  setSlugManual: React.Dispatch<React.SetStateAction<boolean>>;
  categories: string[];
  coverRef: React.RefObject<HTMLInputElement | null>;
  coverBusy: boolean;
  onCoverFile: (file: File | undefined) => Promise<void> | void;
  coverCropSrc: string | null;
  setCoverCropSrc: React.Dispatch<React.SetStateAction<string | null>>;
  applyCoverCrop: (dataUrl: string) => Promise<void> | void;
  videoFileRef: React.RefObject<HTMLInputElement | null>;
  videoBusy: boolean;
  onVideoFile: (file: File | undefined) => Promise<void> | void;
  videoNorm: ReturnType<typeof normalizeVideoInput> | null;
  videoPreviewSrc: string;
  setEditorBusy: React.Dispatch<React.SetStateAction<boolean>>;
  addProduct: (ma: string) => void;
}) {
  const titleLen = editing.title.length;

  return (
    <div
      className="relative px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-5 sm:pb-8 sm:pt-20"
      style={{ background: "#F3F4F6" }}
    >
      <ArticleSaveBar
        editing={editing}
        dirty={dirty}
        mediaBusy={mediaBusy}
        saving={saving}
        closeEdit={closeEdit}
        save={save}
      />

      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-8 pb-2">
          <BasicInfoSection
            editing={editing}
            patchEditing={patchEditing}
            slugManual={slugManual}
            setSlugManual={setSlugManual}
            titleLen={titleLen}
            categories={categories}
          />

          <CoverSection
            editing={editing}
            patchEditing={patchEditing}
            coverRef={coverRef}
            coverBusy={coverBusy}
            onCoverFile={onCoverFile}
            setCoverCropSrc={setCoverCropSrc}
          />

          <VideoSection
            editing={editing}
            patchEditing={patchEditing}
            videoFileRef={videoFileRef}
            videoBusy={videoBusy}
            onVideoFile={onVideoFile}
            videoNorm={videoNorm}
            videoPreviewSrc={videoPreviewSrc}
          />

          <SummaryContentSection
            editing={editing}
            patchEditing={patchEditing}
            setEditorBusy={setEditorBusy}
          />

          <ProductsPublishSection
            editing={editing}
            patchEditing={patchEditing}
            addProduct={addProduct}
            closeEdit={closeEdit}
            save={save}
            saving={saving}
            mediaBusy={mediaBusy}
          />
        </div>
      </div>

      <ArticleImageCropDialog
        open={!!coverCropSrc}
        imageSrc={coverCropSrc || ""}
        aspect={1}
        title="Cắt ảnh đại diện (vuông)"
        busy={coverBusy}
        onCancel={() => setCoverCropSrc(null)}
        onApply={applyCoverCrop}
      />
    </div>
  );
}
