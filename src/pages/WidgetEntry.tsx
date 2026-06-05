import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Dedicated path-based routes for Android home-screen widgets.
 * Native deep-linking sometimes drops query strings, so widgets target
 * clean paths here and we internally redirect to the canonical page
 * with the proper trigger query param.
 */
const useWidgetRedirect = (target: string) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(target, { replace: true });
  }, [navigate, target]);
  return null;
};

export const WidgetAddTask = () => useWidgetRedirect("/todo/today?add=1");
export const WidgetNewSticky = () => useWidgetRedirect("/notesdashboard?newNote=sticky");
export const WidgetNewLined = () => useWidgetRedirect("/notesdashboard?newNote=lined");
export const WidgetNewRegular = () => useWidgetRedirect("/notesdashboard?newNote=regular");
export const WidgetNewSketch = () => useWidgetRedirect("/notesdashboard?newNote=sketch");