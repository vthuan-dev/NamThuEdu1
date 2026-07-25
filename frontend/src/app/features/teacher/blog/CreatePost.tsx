import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import {
  ChevronRight,
  Save,
  Eye,
  Upload,
  X,
  ChevronDown,
  ArrowLeft,
  BookOpen,
  Lightbulb,
  BookMarked,
  GraduationCap,
  Newspaper,
  Send,
  Info,
  FileText,
  Plus,
} from "lucide-react";
import { useBlog } from "../../../../hooks/useBlog";
import { useToast } from "../../../../hooks/useToast";
import { generateSlug } from "../../../../utils/slugUtils";
import { blogTypeApi, BlogType, teacherBlogApi } from "../../../../services/blogApi";

type PostTypeOption = {
  value: string;
  label: string;
  icon: React.ElementType;
};

// Icon mapping for blog types
const iconMap: Record<string, React.ElementType> = {
  BookOpen,
  Lightbulb,
  BookMarked,
  GraduationCap,
  Newspaper,
  FileText,
};

const categoryOptions = [
  { value: 1, label: "IELTS" },
  { value: 2, label: "TOEFL" },
  { value: 3, label: "Cambridge" },
  { value: 4, label: "General English" },
  { value: 5, label: "VSTEP" },
];

export function CreatePost() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const { t } = useTranslation();
  const isEditing = Boolean(postId);
  const { createBlog, updateBlog, loading } = useBlog();
  const { success: showSuccess, error: showError } = useToast();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<string>("grammar");
  const [category, setCategory] = useState("1");
  const [slug, setSlug] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [metaDescription, setMetaDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  
  // State for custom post types
  const [typeOptions, setTypeOptions] = useState<PostTypeOption[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newlyAddedType, setNewlyAddedType] = useState<string | null>(null);

  // Fetch blog types on mount
  useEffect(() => {
    const fetchBlogTypes = async () => {
      try {
        setLoadingTypes(true);
        const response = await blogTypeApi.getBlogTypes();
        
        if (response.data.status === 'success') {
          const types: PostTypeOption[] = response.data.data.map((type: BlogType) => ({
            value: type.type_value,
            label: type.type_label,
            icon: iconMap[type.type_icon] || FileText,
          }));
          
          setTypeOptions(types);
          
          // Set default type if available
          if (types.length > 0 && !postType) {
            setPostType(types[0].value);
          }
        }
      } catch (error: any) {
        console.error('Failed to fetch blog types:', error);
        showError(t("blog.create.errorLoadTypes"));
      } finally {
        setLoadingTypes(false);
      }
    };

    fetchBlogTypes();
  }, []);

  // Fetch post details if editing
  useEffect(() => {
    if (!postId) return;

    const fetchPostDetail = async () => {
      try {
        const response = await teacherBlogApi.getBlogDetail(parseInt(postId));
        if (response.data.status === 'success') {
          const blog = response.data.data;
          setTitle(blog.pTitle || "");
          setContent(blog.pContent || "");
          setPostType(blog.pType || "grammar");
          setCategory(String(blog.pCategory || "1"));
          setSlug(blog.pUrl || "");
          setThumbnail(blog.pThumbnail || null);
        }
      } catch (error: any) {
        console.error('Failed to fetch post detail:', error);
        showError(t("blog.create.errorLoadPostDetail") || "Không thể tải chi tiết bài viết");
      }
    };

    fetchPostDetail();
  }, [postId]);

  const wordCount = content
    .replace(/<[^>]*>/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  const charCount = content.replace(/<[^>]*>/g, "").length;

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ align: [] }],
      ["link", "image", "code-block"],
      ["blockquote"],
      [{ color: [] }, { background: [] }],
      ["clean"],
    ],
  };

  const quillFormats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "align",
    "link",
    "image",
    "code-block",
    "blockquote",
    "color",
    "background",
  ];

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    const newSlug = generateSlug(newTitle);
    setSlug(newSlug);
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError(t("blog.create.errorImageType"));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showError(t("blog.create.errorImageSize"));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setThumbnail(reader.result as string);
      showSuccess(t("blog.create.successImageUpload"));
    };
    reader.onerror = () => {
      showError(t("blog.create.errorImageRead"));
    };
    reader.readAsDataURL(file);
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      showError(t("blog.create.errorTitleRequired"));
      return false;
    }
    if (!content.trim() || content === "<p><br></p>") {
      showError(t("blog.create.errorContentRequired"));
      return false;
    }
    return true;
  };

  const handleSubmit = async (status: "draft" | "pending") => {
    if (!validateForm()) return;

    try {
      if (isEditing && postId) {
        await updateBlog(parseInt(postId), {
          blogName: title,
          blogContent: content,
          blogType: postType as any,
          blogCategory: parseInt(category),
          blogUrl: slug,
          blogThumbnail: thumbnail || "",
          blogStatus: status,
        });

        if (status === "draft") {
          showSuccess(t("blog.create.successDraft") || "Lưu bản nháp thành công!");
        } else {
          showSuccess(t("blog.create.successUpdate") || "Cập nhật bài viết thành công!");
        }

        // Log activity (best-effort)
        import("../../../../services/teacherActivityLog").then(({ logTeacherActivity }) => {
          logTeacherActivity({
            action: "blog.update",
            entity_type: "blog",
            detail: `Cập nhật bài viết: ${title}`,
          });
        });
      } else {
        await createBlog({
          blogName: title,
          blogContent: content,
          blogType: postType as any,
          blogCategory: parseInt(category),
          blogUrl: slug,
          blogThumbnail: thumbnail || "",
          blogStatus: status,
        });

        showSuccess(
          status === "draft"
            ? (t("blog.create.successDraft") || "Lưu nháp thành công!")
            : (t("blog.create.successSubmit") || "Gửi duyệt bài viết thành công!")
        );

        // Log activity (best-effort)
        import("../../../../services/teacherActivityLog").then(({ logTeacherActivity }) => {
          logTeacherActivity({
            action: status === "draft" ? "blog.create" : "blog.publish",
            entity_type: "blog",
            detail: status === "draft" ? `Lưu nháp: ${title}` : `Đăng bài: ${title}`,
          });
        });
      }

      setTimeout(() => {
        navigate("/giao-vien/bai-viet");
      }, 1000);
    } catch (error: any) {
      showError(
        error.response?.data?.message || t("blog.create.errorSave")
      );
    }
  };

  const handleAddNewType = async () => {
    if (!newTypeName.trim()) {
      showError(t("blog.create.errorTypeRequired"));
      return;
    }

    // Auto-generate slug from name
    const autoSlug = generateSlug(newTypeName);

    // Check if type already exists
    if (typeOptions.some(opt => opt.value === autoSlug)) {
      showError(t("blog.create.errorTypeExists"));
      return;
    }

    try {
      console.log('Creating blog type:', { autoSlug, newTypeName });
      
      // Call API to create new blog type
      const response = await blogTypeApi.createBlogType({
        type_value: autoSlug,
        type_label: newTypeName,
        type_icon: 'FileText',
      });

      console.log('API Response:', response);

      if (response.data.status === 'success') {
        // Add new type to the list
        const newType: PostTypeOption = {
          value: response.data.data.type_value,
          label: response.data.data.type_label,
          icon: iconMap[response.data.data.type_icon] || FileText,
        };

        console.log('New type created:', newType);
        
        setTypeOptions([...typeOptions, newType]);
        setPostType(newType.value);
        setNewlyAddedType(newType.value); // Mark as newly added for animation
        setShowAddTypeModal(false);
        setNewTypeName("");
        
        // Remove animation class after animation completes
        setTimeout(() => {
          setNewlyAddedType(null);
        }, 600);
        
        console.log('Calling showSuccess...');
        showSuccess(t("blog.create.successTypeAdded"));
        console.log('showSuccess called');
      } else {
        console.log('Response status not success:', response.data);
        showError(t("blog.create.errorTypeCreate"));
      }
    } catch (error: any) {
      console.error('Failed to create blog type:', error);
      console.error('Error details:', error.response);
      
      // Check for duplicate error
      if (error.response?.status === 422) {
        showError(t("blog.create.errorTypeExists"));
      } else {
        showError(error.response?.data?.message || t("blog.create.errorTypeCreate"));
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80">
      <style>{`
        .quill-editor .ql-toolbar.ql-snow {
          position: sticky;
          top: 56px;
          z-index: 20;
          background: #F9FAFB !important;
          border-top-left-radius: 11px;
          border-top-right-radius: 11px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          border-top: none !important;
          border-left: none !important;
          border-right: none !important;
        }
      `}</style>
      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900">
                  {t("blog.create.previewTitle")}
                </h2>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1.5 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-white">
              <div className="max-w-3xl mx-auto px-8 py-10">
                {thumbnail && (
                  <div className="w-full h-64 rounded-xl overflow-hidden mb-8">
                    <img
                      src={thumbnail}
                      alt={title || "Thumbnail"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-4">
                  {(() => {
                    const typeOpt = typeOptions.find(
                      (t) => t.value === postType
                    );
                    return typeOpt ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md">
                        <typeOpt.icon className="w-3.5 h-3.5" />
                        {typeOpt.label}
                      </span>
                    ) : null;
                  })()}
                  <span className="text-xs text-slate-400">
                    {new Date().toLocaleDateString("vi-VN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-xs text-slate-400">
                    {wordCount} {t("blog.create.words")}
                  </span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-6 leading-tight">
                  {title || (
                    <span className="text-slate-300">{t("blog.create.titlePlaceholder")}</span>
                  )}
                </h1>
                <div
                  className="prose prose-slate prose-base md:prose-lg max-w-3xl"
                  dangerouslySetInnerHTML={{
                    __html:
                      content ||
                      `<p class="text-slate-400 italic">${t("blog.create.contentPreview")}</p>`,
                  }}
                />
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
              >
                {t("blog.create.closePreview")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full px-8 sm:px-12 lg:px-16 xl:px-20 py-6">
        {/* Breadcrumb & Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link
                to="/giao-vien/bai-viet"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white rounded-xl hover:bg-orange-50 hover:text-orange-600 transition-colors cursor-pointer"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
              >
                <ArrowLeft className="w-4 h-4" />
                {t("blog.create.btnBack")}
              </Link>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Link
                  to="/giao-vien/bai-viet"
                  className="hover:text-blue-600 transition-colors cursor-pointer font-medium"
                >
                  {t("blog.create.breadcrumb")}
                </Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-slate-900 font-semibold">
                  {isEditing ? t("blog.create.breadcrumbEdit") : t("blog.create.breadcrumbCreate")}
                </span>
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditing ? t("blog.create.titleEdit") : t("blog.create.titleCreate")}
          </h1>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Editor */}
          <div className="lg:col-span-2 space-y-4">
            {/* Title */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5">
              <input
                type="text"
                placeholder={t("blog.create.inputTitlePlaceholder")}
                value={title}
                onChange={handleTitleChange}
                className="w-full text-xl font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none"
              />
            </div>

            {/* Rich Text Editor */}
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-visible">
              <ReactQuill
                theme="snow"
                value={content}
                onChange={setContent}
                modules={quillModules}
                formats={quillFormats}
                placeholder={t("blog.create.contentPlaceholder")}
                className="quill-editor"
                style={{ minHeight: "380px" }}
              />
              <div className="border-t border-slate-100 px-5 py-2.5 flex items-center justify-between text-xs text-slate-400">
                <span>{wordCount} {t("blog.create.words")}</span>
                <span>{charCount} {t("blog.create.characters")}</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <FileText className="w-3.5 h-3.5" />
                <span>
                  {t(`blog.type.${postType}`)} / {categoryOptions.find((c) => c.value === parseInt(category))?.label || t("blog.create.categoryGeneral")}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleSubmit("draft")}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-3.5 h-3.5" />
                  {t("blog.create.btnSaveDraft")}
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {t("blog.create.btnPreview")}
                </button>
                <button
                  onClick={() => handleSubmit("pending")}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  {loading 
                    ? (isEditing ? "Đang cập nhật..." : t("blog.create.btnSubmitting")) 
                    : (isEditing ? "Cập nhật" : t("blog.create.btnSubmitReview"))}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Settings (sticky, cuộn độc lập) */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1 blog-settings-scroll">
            {/* Post Type */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {t("blog.create.sectionPostType")}
                </h3>
                <button
                  onClick={() => setShowAddTypeModal(true)}
                  disabled={loadingTypes}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("blog.create.btnAddType")}
                </button>
              </div>
              
              {loadingTypes ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {typeOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-300 ${
                        postType === opt.value
                          ? "bg-blue-50 border border-blue-200"
                          : "hover:bg-slate-50 border border-transparent"
                      } ${
                        newlyAddedType === opt.value
                          ? "animate-slideInFromRight"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="postType"
                        value={opt.value}
                        checked={postType === opt.value}
                        onChange={(e) => setPostType(e.target.value)}
                        className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500/20"
                      />
                      <opt.icon
                        className={`w-4 h-4 ${
                          postType === opt.value
                            ? "text-blue-600"
                            : "text-slate-400"
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          postType === opt.value
                            ? "text-blue-700 font-medium"
                            : "text-slate-700"
                        }`}
                      >
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Category & Slug */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                {t("blog.create.sectionSettings")}
              </h3>

              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  {t("blog.create.labelCategory")}
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none transition-colors"
                  >
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  {t("blog.create.labelSlug")}
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={t("blog.create.slugPlaceholder")}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  /blog/{slug || "url-slug"}
                </p>
              </div>
            </div>

            {/* Thumbnail */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                {t("blog.create.sectionThumbnail")}
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">
                {t("blog.create.thumbnailDesc")}
              </p>

              {thumbnail ? (
                <div className="relative group">
                  <img
                    src={thumbnail}
                    alt="Thumbnail"
                    className="w-full h-36 object-cover rounded-lg border border-slate-200"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <label className="cursor-pointer px-3 py-1.5 bg-white text-slate-900 text-xs font-medium rounded-md hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      {t("blog.create.btnChangeImage")}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => setThumbnail(null)}
                      className="px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-md hover:bg-rose-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      {t("blog.create.btnRemove")}
                    </button>
                  </div>
                </div>
              ) : (
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                    <Upload className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-600">
                      {t("blog.create.uploadPrompt")}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t("blog.create.uploadHint")}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* SEO */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                SEO
              </h3>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  {t("blog.create.labelMetaDesc")}
                </label>
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder={t("blog.create.metaDescPlaceholder")}
                  maxLength={160}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-colors"
                  rows={3}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {metaDescription.length}/160 {t("blog.create.characters")}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  {t("blog.create.labelKeywords")}
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder={t("blog.create.keywordsPlaceholder")}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
              <div className="flex gap-2.5">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800 space-y-1">
                  <p>
                    <strong>{t("blog.create.infoDraftTitle")}:</strong> {t("blog.create.infoDraftDesc")}
                  </p>
                  <p>
                    <strong>{t("blog.create.infoSubmitTitle")}:</strong> {t("blog.create.infoSubmitDesc")}
                  </p>
                  <p>
                    {t("blog.create.infoNotification")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Type Modal */}
      {showAddTypeModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddTypeModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {t("blog.create.addTypeTitle")}
              </h3>
              <button
                onClick={() => setShowAddTypeModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("blog.create.labelTypeName")}
                </label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder={t("blog.create.typeNamePlaceholder")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {t("blog.create.typeAutoSlugHint")}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddTypeModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  {t("blog.create.btnCancel")}
                </button>
                <button
                  onClick={handleAddNewType}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  {t("blog.create.btnAddTypeConfirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
