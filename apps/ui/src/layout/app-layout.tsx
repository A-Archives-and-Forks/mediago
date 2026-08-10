import { type FC, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CHANGE_PAGE } from "@/const";
import { tdApp } from "@/utils";
import { AppHeader } from "./app-header";
import { AppSideBar } from "./app-side-bar";

function PageAnalytics() {
  const location = useLocation();

  useEffect(() => {
    tdApp.onEvent(CHANGE_PAGE, { page: location.pathname });
  }, [location.pathname]);

  return null;
}

const App: FC = () => {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <PageAnalytics />
      <AppHeader className="shrink-0" />
      <div className="flex flex-1 flex-col overflow-hidden bg-[#F4F7FA] sm:flex-row dark:bg-[#141415]">
        <AppSideBar />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default App;
