import { CommonActions, type NavigationProp, type ParamListBase } from "@react-navigation/native";

type NavWithParent = NavigationProp<ParamListBase> & {
  getParent?: () => NavWithParent | undefined;
};

/** Walk to root stack and replace state with Main (clears onboarding). */
export function dispatchResetToMain(navigation: NavigationProp<ParamListBase>) {
  let nav: NavWithParent | undefined = navigation as NavWithParent;
  while (nav?.getParent?.()) {
    nav = nav.getParent() as NavWithParent;
  }
  nav?.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Main" }],
    })
  );
}
