import React, { useEffect, useState } from "react";
import {
  ScheduleOutlined,
  DatabaseOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  PaperClipOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Button, Layout, List, Menu, Modal, Spin, theme } from "antd";
import { configState, fetchConfig } from "../state/config";
import { useRecoilState, useRecoilValue } from "recoil";
import { Config, Plan } from "../../gen/ts/v1/config.pb";
import { useAlertApi } from "../components/Alerts";
import { useShowModal } from "../components/ModalManager";
import { AddPlanModal } from "./AddPlanModel";
import { AddRepoModel } from "./AddRepoModel";
import { MainContentArea, useSetContent } from "./MainContentArea";
import { PlanView } from "./PlanView";
import {
  EOperation,
  buildOperationListListener,
  getOperations,
  subscribeToOperations,
  toEop,
  unsubscribeFromOperations,
} from "../state/oplog";
import { formatTime } from "../lib/formatting";
import { SnapshotBrowser } from "../components/SnapshotBrowser";
import { OperationRow } from "../components/OperationList";
import {
  Operation,
  OperationEvent,
  OperationEventType,
} from "../../gen/ts/v1/operations.pb";
import { MessageInstance } from "antd/es/message/interface";

const { Header, Content, Sider } = Layout;

export const App: React.FC = () => {
  const {
    token: { colorBgContainer, colorTextLightSolid },
  } = theme.useToken();

  const [config, setConfig] = useRecoilState(configState);
  const alertApi = useAlertApi()!;
  const showModal = useShowModal();
  const setContent = useSetContent();

  useEffect(() => {
    showModal(<Spin spinning={true} fullscreen />);

    fetchConfig()
      .then((config) => {
        setConfig(config);
        showModal(null);
      })
      .catch((err) => {
        alertApi.error(err.message, 0);
        alertApi.error(
          "Failed to fetch initial config, typically this means the UI could not connect to the backend"
        );
      });
  }, []);

  const items = getSidenavItems(config);

  return (
    <Layout style={{ height: "auto" }}>
      <OperationNotificationGenerator />
      <Header style={{ display: "flex", alignItems: "center" }}>
        <h1>
          <a
            style={{ color: colorTextLightSolid }}
            onClick={() => setContent(null, [])}
          >
            ResticUI{" "}
          </a>
          <small style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.3em" }}>
            {process.env.BUILD_TIME ? "v" + process.env.BUILD_TIME : ""}
          </small>
        </h1>
      </Header>
      <Layout>
        <Sider width={300} style={{ background: colorBgContainer }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={["1"]}
            defaultOpenKeys={["plans", "repos"]}
            style={{ height: "100%", borderRight: 0 }}
            items={items}
          />
        </Sider>
        <MainContentArea />
      </Layout>
    </Layout>
  );
};

const getSidenavItems = (config: Config | null): MenuProps["items"] => {
  const showModal = useShowModal();
  const setContent = useSetContent();

  if (!config) return [];

  const configPlans = config.plans || [];
  const configRepos = config.repos || [];

  const plans: MenuProps["items"] = [
    {
      key: "add-plan",
      icon: <PlusOutlined />,
      label: "Add Plan",
      onClick: () => {
        showModal(<AddPlanModal template={null} />);
      },
    },
    ...configPlans.map((plan) => {
      return {
        key: "p-" + plan.id,
        icon: <CheckCircleOutlined style={{ color: "green" }} />,
        label: plan.id,
        onClick: () => {
          setContent(<PlanView plan={plan} />, [
            { title: "Plans" },
            { title: plan.id || "" },
          ]);
        },
      };
    }),
  ];

  const repos: MenuProps["items"] = [
    {
      key: "add-repo",
      icon: <PlusOutlined />,
      label: "Add Repo",
      onClick: () => {
        showModal(<AddRepoModel template={null} />);
      },
    },
    ...configRepos.map((repo) => {
      return {
        key: "r-" + repo.id,
        icon: <CheckCircleOutlined style={{ color: "green" }} />,
        label: repo.id,
        onClick: () => {
          showModal(<AddRepoModel template={repo} />);
        },
      };
    }),
  ];

  return [
    {
      key: "plans",
      icon: React.createElement(ScheduleOutlined),
      label: "Plans",
      children: plans,
    },
    {
      key: "repos",
      icon: React.createElement(DatabaseOutlined),
      label: "Repositories",
      children: repos,
    },
  ];
};

const OperationNotificationGenerator = () => {
  const alertApi = useAlertApi()!;
  const setContent = useSetContent();
  const config = useRecoilValue(configState);

  useEffect(() => {
    const listener = (event: OperationEvent) => {
      if (event.type != OperationEventType.EVENT_CREATED) return;
      const planId = event.operation!.planId!;
      const repoId = event.operation!.repoId!;

      const onClick = () => {
        const plan = config.plans!.find((p) => p.id == planId);
        if (!plan) return;
        setContent(<PlanView plan={plan} />, [
          { title: "Plans" },
          { title: planId || "" },
        ]);
      };

      if (event.operation?.operationBackup) {
        alertApi.info({
          content: `Backup started for plan ${planId}.`,
          onClick: onClick,
        });
      } else if (event.operation?.operationIndexSnapshot) {
        const indexOp = event.operation.operationIndexSnapshot;
        alertApi.info({
          content: `Indexed snapshot ${indexOp.snapshot!
            .id!} for plan ${planId}.`,
          onClick: onClick,
        });
      }
    };
    subscribeToOperations(listener);

    return () => {
      unsubscribeFromOperations(listener);
    };
  }, [config]);

  return <></>;
};
