// 고정 ID 대신 랜덤 ID 생성 함수 추가
export const generateUniqueId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};
