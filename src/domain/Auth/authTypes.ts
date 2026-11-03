export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends SignInInput {
  fullName: string;
}
