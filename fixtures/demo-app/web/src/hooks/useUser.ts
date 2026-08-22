import { fetchUser } from '../api/users';

export function useUser(id: string) {
  return fetchUser(id);
}
