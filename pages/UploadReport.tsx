import React, { useState } from "react";
import { requestUploadUrl } from "../services/api";

const UploadReport: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const flash = (type: "success" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target as HTMLInputElement;
    if (!(inputEl.files && inputEl.files[0])) return;

    const file = inputEl.files[0];

    if (!/\.csv$/i.test(file.name)) {
      flash("error", "Please upload a .csv file (Excel .xlsx won't be processed).");
      inputEl.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const contentType = "text/csv";
      const presign: any = await requestUploadUrl(file.name, contentType);
      const uploadUrl: string = presign.uploadUrl;

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });

      if (!put.ok) {
        const t = await put.text();
        throw new Error(`S3 upload failed: ${put.status} ${t || put.statusText}`);
      }

      flash("success", `Report file "${file.name}" uploaded. Processing has started.`);
    } catch (err: any) {
      console.error("Upload failed", err);
      flash("error", err?.message || "Upload failed. See console for details.");
    } finally {
      setIsUploading(false);
      if (e.target) (e.target as HTMLInputElement).value = "";
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Upload Report</h1>

      {notice && (
        <div
          className={`rounded-md px-4 py-3 ${
            notice.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-8 max-w-xl">
        <p className="mb-6 text-gray-600">Select a CSV file to upload.</p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark file:text-white hover:file:bg-primary disabled:opacity-60"
        />
        {isUploading && <p className="mt-4 text-gray-700">Uploading and processing…</p>}
      </div>
    </div>
  );
};

export default UploadReport;
