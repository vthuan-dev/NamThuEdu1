/**
 * Utility functions to extract data from kids_task_config
 * Handles multiple possible field names and nested structures
 */

import { Question, TaskData } from '../types/exam';

export function extractTaskData(question: Question): TaskData {
  const taskData = question.kids_task_config || {};
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  // Spread the raw editor config (realTaskData) + nested config FIRST so that any
  // field the editor saved (text, story, word_bank, gaps, options, matchingMode,
  // answer_format, targetLabel, ...) is directly readable on the returned object.
  // The normalized fields below then override with consistent names.
  return {
    ...config,
    ...realTaskData,
    task_type: taskData.task_type || realTaskData.task_type || config.task_type,
    task_data: realTaskData,
    config,
    instructions: taskData.instructions || realTaskData.instructions || config.instructions || question.qContent,
    imageUrl: realTaskData?.imageUrl || realTaskData?.image_url || realTaskData?.mainImage || 
              realTaskData?.mainImageUrl || realTaskData?.sharedImageUrl || realTaskData?.shared_image_url ||
              config?.imageUrl || config?.image_url || config?.mainImage || 
              config?.mainImageUrl || config?.sharedImageUrl || config?.shared_image_url ||
              (question as any)?.qMedia_url,
    audioUrl: realTaskData?.audioUrl || realTaskData?.audio_url || realTaskData?.mainAudioUrl ||
              config?.audioUrl || config?.audio_url || config?.mainAudioUrl ||
              (question as any)?.qMedia_url,
    items: realTaskData?.items || config?.items || [],
    questions: realTaskData?.questions || config?.questions || []
  };
}

export function getActualTaskType(question: Question): string {
  if (question.qType !== 'kids_task') {
    return question.qType;
  }
  
  const taskData = extractTaskData(question);
  return taskData.task_type || question.qType;
}

export function getPartInfo(partNumber: number) {
  const partNames: { [key: number]: { name: string; icon: string; color: string } } = {
    1: { name: 'LISTENING', icon: '🎧', color: 'bg-blue-500' },
    2: { name: 'READING & WRITING', icon: '📖', color: 'bg-purple-500' },
    3: { name: 'SPEAKING', icon: '🗣️', color: 'bg-orange-500' },
  };
  return partNames[partNumber] || { name: `PART ${partNumber}`, icon: '📝', color: 'bg-gray-500' };
}

export function getTaskTypeName(taskType: string): string {
  const taskTypeNames: { [key: string]: string } = {
    'listen_and_draw_lines': 'Listen and Draw Lines',
    'listen_and_write': 'Listen and Write',
    'listen_and_tick': 'Listen and Tick',
    'listen_colour_write': 'Listen, Colour and Write',
    'look_and_read': 'Look and Read',
    'look_read_write': 'Look, Read and Write',
    'unscramble_words': 'Unscramble Words',
    'cloze_test': 'Cloze Test',
    'dialogue_matching': 'Dialogue Matching',
    'word_definition_matching': 'Word Definition Matching',
    'word_bank_fill': 'Word Bank Fill',
    'find_differences': 'Find Differences',
    'picture_story_narration': 'Picture Story Narration',
    'odd_one_out': 'Odd One Out',
    'information_exchange': 'Information Exchange',
    'object_placement': 'Object Placement',
    'picture_questions': 'Picture Questions',
    'picture_card_questions': 'Picture Card Questions',
    'listening_letter_match': 'Listening Letter Match',
  };
  return taskTypeNames[taskType] || taskType;
}

export function groupQuestionsByPart(questions: Question[]) {
  const listening = questions.filter(q => q.qPart === 1).sort((a, b) => (a.qSubPart || 0) - (b.qSubPart || 0));
  const reading = questions.filter(q => q.qPart === 2).sort((a, b) => (a.qSubPart || 0) - (b.qSubPart || 0));
  const speaking = questions.filter(q => q.qPart === 3).sort((a, b) => (a.qSubPart || 0) - (b.qSubPart || 0));
  
  return { listening, reading, speaking };
}
