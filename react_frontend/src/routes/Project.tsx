import React, { useEffect, useRef } from "react";
import { Params, useLoaderData, useRouteError } from "react-router";
import axios from "axios";
import { lazy, Suspense } from "react";
import WebGUIPreview from "Components/visualizers/WebGUIPreview";
import ExerciseContainer from "Components/layouts/ExerciseContainer";
import { exitProject, getProjectData, sendHeartbeat } from "Api";
import WebGUILoading from "Components/visualizers/WebGUILoading";
import { ExerciseData } from "Types/exercises";
import { useAcademyTheme } from "Contexts/AcademyThemeContext";
import { BasicHeader } from "Components/headers";
import {
  StyledErrorContainer,
  StyledErrorMessage,
} from "Styles/pages/Project.styles";

// Must stay well below SESSION_TIMEOUT in academy/views.py
const HEARTBEAT_INTERVAL = 15000;

export const loader = async ({
  params,
}: {
  params: Params<string>;
}): Promise<Omit<ExerciseData, "worlds">> => {
  return await getProjectData(params.proj_id);
};

const Exercise = () => {
  const hasRender = useRef(false);
  const data = useLoaderData<Omit<ExerciseData, "worlds">>();

  const WebGui = lazy(async () => {
    return import(`exercises/${data.exercise_id}/frontend/WebGUI.tsx`).catch(
      (error) => {
        console.error("Component Failed Loading:", error);
        return { default: WebGUIPreview };
      },
    );
  });

  useEffect(() => {
    const handleUnload = () => {
      exitProject(data.session);
    };

    window.addEventListener("pagehide", handleUnload);
    const heartbeat = window.setInterval(
      () => sendHeartbeat(data.session),
      HEARTBEAT_INTERVAL,
    );

    return () => {
      window.removeEventListener("pagehide", handleUnload);
      window.clearInterval(heartbeat);
      // This is to fix this: fires twice thanks to react Strict mode
      if (hasRender.current || process.env.NODE_ENV !== "development") {
        exitProject(data.session);
      }
      hasRender.current = true;
    };
  }, []);

  return (
    <>
      <ExerciseContainer
        multiLanguage={data.tags.includes("MULTILANGUAGE")}
        additionalEntrypoints={data.entrypoints}
        project={data.exercise_id}
        name={data.name}
        tools={data.tools}
        url={data.url !== "" ? data.url : undefined}
      >
        <Suspense fallback={<WebGUILoading />}>
          <WebGui />
        </Suspense>
      </ExerciseContainer>
    </>
  );
};

export const ErrorBoundary = () => {
  const theme = useAcademyTheme();
  const error = useRouteError();

  const cause = error instanceof Error ? error.cause : undefined;
  const alreadyOpen =
    axios.isAxiosError(cause) && cause.response?.status === 409;

  if (alreadyOpen) {
    return (
      <>
        <BasicHeader />
        <StyledErrorContainer bgColor={theme.palette.bg}>
          <StyledErrorMessage color={theme.palette.error}>
            You have open a Robotics Academy exercise in another tab or window
          </StyledErrorMessage>
          <StyledErrorMessage color={theme.palette.error}>
            You can only have one open at a time
          </StyledErrorMessage>
          <StyledErrorMessage color={theme.palette.error}>
            Close the other instance or exit the exercise and refresh the page
            to continue
          </StyledErrorMessage>
          <StyledErrorMessage color={theme.palette.error}>
            If it was closed unexpectedly, wait 90 seconds and refresh the page
          </StyledErrorMessage>
        </StyledErrorContainer>
      </>
    );
  }

  const message =
    error instanceof Error && error.message
      ? error.message
      : "The server could not load this exercise";

  return (
    <>
      <BasicHeader />
      <StyledErrorContainer bgColor={theme.palette.bg}>
        <StyledErrorMessage color={theme.palette.error}>
          Unable to open the exercise
        </StyledErrorMessage>
        <StyledErrorMessage color={theme.palette.error}>
          {message}
        </StyledErrorMessage>
      </StyledErrorContainer>
    </>
  );
};

export default Exercise;
