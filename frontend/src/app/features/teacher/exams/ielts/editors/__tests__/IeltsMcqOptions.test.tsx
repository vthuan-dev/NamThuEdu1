import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { IeltsListeningEditor } from "../IeltsListeningEditor";
import { IeltsReadingEditor } from "../IeltsReadingEditor";
import { ToastProvider } from "../../../../../../../contexts/ToastContext";

vi.mock("../../../../../../../services/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../../../../../../components/ui/RichTextInput", () => ({
  RichTextInput: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="rich-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

describe("IeltsListeningEditor - MCQ Options Independence", () => {
  it("renders distinct editable option inputs for consecutive MCQ questions (Q11 & Q12)", () => {
    const initialData = {
      sections: [
        {
          sectionNumber: 2,
          sectionTitle: "Section 2",
          questions: [
            {
              id: "s2-q11",
              questionNumber: 11,
              questionType: "multiple-choice",
              questionText: "Stevenson's was founded in",
              options: { A: "1923.", B: "1924.", C: "1926." },
              correctAnswer: "A",
            },
            {
              id: "s2-q12",
              questionNumber: 12,
              questionType: "multiple-choice",
              questionText: "Originally, Stevenson's manufactured goods for",
              options: { A: "", B: "", C: "" },
              correctAnswer: "B",
            },
          ],
        },
      ],
    };

    const handleSave = vi.fn();

    render(
      <ToastProvider>
        <IeltsListeningEditor
          initialData={initialData}
          onSave={handleSave}
          isFullTest={false}
        />
      </ToastProvider>
    );

    // Q11 option inputs should exist
    const q11OptA = screen.getByDisplayValue("1923.");
    expect(q11OptA).toBeDefined();

    // Q12 placeholder inputs for A, B, C should exist and be editable
    const placeholdersA = screen.getAllByPlaceholderText("Đáp án A");
    expect(placeholdersA.length).toBeGreaterThanOrEqual(2); // One for Q11, one for Q12

    // Q12 option A can be typed into
    const q12OptA = placeholdersA[1];
    fireEvent.change(q12OptA, { target: { value: "the healthcare industry" } });

    expect(screen.getByDisplayValue("the healthcare industry")).toBeDefined();

    // Does NOT render misleading "Dùng cài đặt chung ở câu 11" for regular MCQ
    expect(screen.queryByText(/Dùng cài đặt chung ở câu 11/i)).toBeNull();
  });
});

describe("IeltsReadingEditor - MCQ Options Independence", () => {
  it("renders distinct editable option inputs for single MCQ in reading even if options initially undefined", () => {
    const initialData = {
      passages: [
        {
          passageNumber: 1,
          passageTitle: "Passage 1",
          body: "Sample reading text",
          groups: [
            {
              id: "g1",
              questionType: "multiple-choice",
              instruction: "Choose the correct letter, A, B, C or D.",
              questions: [
                {
                  id: "rq1",
                  questionNumber: 1,
                  questionType: "multiple-choice",
                  questionText: "Question 1 prompt",
                  options: { A: "First choice", B: "Second choice" },
                  correctAnswer: "A",
                },
                {
                  id: "rq2",
                  questionNumber: 2,
                  questionType: "multiple-choice",
                  questionText: "Question 2 prompt",
                  options: undefined,
                  correctAnswer: "",
                },
              ],
            },
          ],
        },
      ],
    };

    const handleSave = vi.fn();

    render(
      <ToastProvider>
        <IeltsReadingEditor
          initialData={initialData}
          onSave={handleSave}
        />
      </ToastProvider>
    );

    // Q1 options exist
    expect(screen.getByDisplayValue("First choice")).toBeDefined();

    // Q2 options fall back to A, B, C, D and are editable
    const placeholdersA = screen.getAllByPlaceholderText("Đáp án A");
    expect(placeholdersA.length).toBeGreaterThanOrEqual(2);

    const q2OptA = placeholdersA[1];
    fireEvent.change(q2OptA, { target: { value: "Third choice for Q2" } });
    expect(screen.getByDisplayValue("Third choice for Q2")).toBeDefined();
  });
});
