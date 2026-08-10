import { type FC, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CHANGE_PAGE } from "@/const";
import { tdApp } from "@/utils";
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-canvas sm:flex-row">
      <PageAnalytics />
      <AppSideBar />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
};

export default App;
