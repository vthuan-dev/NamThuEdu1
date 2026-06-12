import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { StudentNavbar } from "../components/student/StudentNavbar";
import { usePushNotification } from "../../hooks/usePushNotification";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { NotificationPermissionBanner } from "../../components/NotificationPermissionBanner";
import { PwaInstallBanner } from "../../components/PwaInstallBanner";
import { ResultDetail } from "../features/student/test-taking/ResultDetail";
import { DailyMotivationPopup } from "../../components/student/DailyMotivationPopup";
import { X } from "lucide-react";

export function StudentLayout() {
  const push = usePushNotification();
  const pwa = usePwaInstall();
  const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(null);
  const location = useLocation();

  // Close modal when route changes
  useEffect(() => {
    setActiveSubmissionId(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleOpenModal = (e: Event) => {
      const customEvent = e as CustomEvent;
      const subId = customEvent.detail?.submissionId;
      if (subId) {
        setActiveSubmissionId(subId);
      }
    };

    const handleCloseModal = () => {
      setActiveSubmissionId(null);
    };

    window.addEventListener("open-result-modal", handleOpenModal);
    window.addEventListener("close-result-modal", handleCloseModal);
    return () => {
      window.removeEventListener("open-result-modal", handleOpenModal);
      window.removeEventListener("close-result-modal", handleCloseModal);
    };
  }, []);

  // Close modal on Escape key press
  useEffect(() => {
    if (activeSubmissionId === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveSubmissionId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSubmissionId]);

  return (
    <div
      className="min-h-screen relative"
      style={{
        background:
          "linear-gradient(160deg, #FAF8FF 0%, #F5F3FF 40%, #F9FAFB 100%)",
      }}
    >
      <NotificationPermissionBanner push={push} />
      <PwaInstallBanner pwa={pwa} />
      <StudentNavbar />

      <DailyMotivationPopup accent="#7C3AED" accentMid="#8B5CF6" accentSoft="#F5F3FF" />

      {/* Main content — extra bottom padding on mobile for bottom nav */}
      <main
        className="w-full"
        style={{ paddingBottom: "80px" }}
      >
        <div className="px-4 sm:px-8">
          <Outlet />
        </div>
      </main>

      {/* Result Detail Modal */}
      {activeSubmissionId !== null && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn"
          onClick={() => setActiveSubmissionId(null)}
        >
          <style>{`
            @keyframes scaleUp {
              from {
                opacity: 0;
                transform: scale(0.96);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
          `}</style>
          <div 
            className="relative bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200/50 p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: "scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setActiveSubmissionId(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all z-10 cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="pt-2">
              <ResultDetail modalSubmissionId={activeSubmissionId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
