import React from 'react';
import { QuestionRendererProps } from '../../types/exam';
import { getActualTaskType, extractTaskData } from '../../utils/examDataExtractor';
import {
  ListenAndDrawLines,
  ListenAndTick,
  ListenAndWrite,
  ListenColourWrite,
  LookAndRead,
  LookReadWrite,
  WordBankFill,
  ClozeTest,
  OpenCloze,
  DialogueMatching,
  WordDefinitionMatching,
  ReadingComprehension,
  ObjectPlacement,
  PictureQuestions,
  InformationExchange,
  PictureCardQuestions,
  ListeningLetterMatch,
  FindDifferences,
  UnscrambleWords,
  OddOneOut,
  PictureStoryNarration,
  PictureStoryWriting,
  PictureSentenceWriting,
  StoryCompletion,
  DefaultQuestion,
} from './questions';

/**
 * Maps a kids task type code -> its student-facing render component.
 *
 * Một số component dùng "contract mới" (QuestionRendererProps:
 * mode/answer/onAnswer + extractTaskData nội bộ), số khác dùng "contract cũ"
 * (taskData/interactiveMode/userAnswer/onAnswerChange). QuestionRenderer bên dưới
 * truyền HỢP của cả hai contract nên mọi component đều nhận đủ props nó cần.
 */
const TASK_COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  // Listening
  listen_and_draw_lines: ListenAndDrawLines,
  listen_and_tick: ListenAndTick,
  listen_and_write: ListenAndWrite,
  listen_colour_write: ListenColourWrite,
  listen_and_colour: ListenColourWrite,
  listen_colour: ListenColourWrite,
  listening_letter_match: ListeningLetterMatch,
  // Reading & Writing
  look_and_read: LookAndRead,
  look_read_write: LookReadWrite,
  word_bank_fill: WordBankFill,
  cloze_test: ClozeTest,
  open_cloze: OpenCloze,
  dialogue_matching: DialogueMatching,
  word_definition_matching: WordDefinitionMatching,
  reading_comprehension: ReadingComprehension,
  unscramble_words: UnscrambleWords,
  odd_one_out: OddOneOut,
  find_differences: FindDifferences,
  story_completion: StoryCompletion,
  // Picture-based
  object_placement: ObjectPlacement,
  picture_questions: PictureQuestions,
  picture_card_questions: PictureCardQuestions,
  information_exchange: InformationExchange,
  picture_story_narration: PictureStoryNarration,
  picture_story_writing: PictureStoryWriting,
  picture_sentence_writing: PictureSentenceWriting,
};

/**
 * Routes to the appropriate question component based on task type.
 * Falls back to DefaultQuestion for any unmapped/unknown type so the student
 * never gets a blank screen.
 */
export function QuestionRenderer(props: QuestionRendererProps) {
  const taskType = getActualTaskType(props.question);
  const Component = TASK_COMPONENT_MAP[taskType] || DefaultQuestion;

  // Bridge: cung cấp đồng thời props của contract cũ lẫn mới.
  const bridgeProps = {
    ...props,
    // Contract cũ
    taskData: extractTaskData(props.question),
    interactiveMode: props.mode === 'student' || props.mode === 'preview',
    userAnswer: props.answer,
    onAnswerChange: props.onAnswer,
  };

  return <Component {...bridgeProps} />;
}
