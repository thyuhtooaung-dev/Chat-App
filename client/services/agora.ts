import type AC from 'agora-chat';

type AgoraSDK = typeof AC;

let agoraSDKInstance: AgoraSDK | null = null;

export const getAgoraChatSDK = async (): Promise<AgoraSDK> => {
  if (agoraSDKInstance) return agoraSDKInstance;
  const agoraModule = await import('agora-chat');
  agoraSDKInstance = agoraModule.default as unknown as AgoraSDK;
  return agoraSDKInstance;
};
