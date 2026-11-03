import * as Linking from 'expo-linking';

/** Path of the invite route: kimi://convite/<token> */
export const INVITE_PATH = 'convite';

export function inviteUrl(token: string): string {
  return Linking.createURL(`${INVITE_PATH}/${token}`);
}
