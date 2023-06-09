import styles from "./styles.module.css";
import classNames from "classnames";
import { FallbackProps } from "react-error-boundary";

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <span>
      {"Oops, something seems to have broken. Click "}
      <span
        className={classNames(styles.reset)}
        onClick={() => {
          localStorage.clear();
          location.reload();
        }}
      >
        here
      </span>
      {" to try and fix things."}
    </span>
  );
}
