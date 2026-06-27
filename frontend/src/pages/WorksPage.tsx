/** Works page (Phase 0 baseline): list, create, and delete works.

This is a minimal foundation that exercises the API client, toast, and confirm
dialog. The full works-page design (sorting, pagination, search, story
structure selection, detail panel) is implemented in Phase 1.
*/
import { useCallback, useEffect, useState, type ReactElement } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  useDisclosure,
} from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import { createWork, deleteWork, listWorks, type Work } from "../api";
import { useApp } from "../context/AppContext";
import { useToast } from "../components/Toast";
import { ConfirmDialog } from "../components/ConfirmDialog";

/** Render the Phase 0 works management baseline. */
export function WorksPage(): ReactElement {
  const createModal = useDisclosure();
  const { notify } = useToast();
  const { setCurrentWorkId } = useApp();
  const [works, setWorks] = useState<Work[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Work | null>(null);

  const loadWorks = useCallback(async () => {
    try {
      setWorks(await listWorks());
    } catch {
      notify("无法连接后端服务", "error");
    }
  }, [notify]);

  useEffect(() => {
    void loadWorks();
  }, [loadWorks]);

  async function handleCreate(): Promise<void> {
    if (!title.trim()) {
      return;
    }
    try {
      const created = await createWork({ title: title.trim(), summary });
      setCurrentWorkId(created.id);
      setTitle("");
      setSummary("");
      createModal.onClose();
      notify("作品已创建", "success");
      await loadWorks();
    } catch {
      notify("创建作品失败", "error");
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!pendingDelete) {
      return;
    }
    try {
      await deleteWork(pendingDelete.id);
      notify("作品已删除", "success");
      await loadWorks();
    } catch {
      notify("删除作品失败", "error");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <h1>作品</h1>
          <p>创建作品并进入大纲或写作流程（Phase 0 基础版）。</p>
        </div>
        <Button color="primary" startContent={<Plus size={18} />} onPress={createModal.onOpen}>
          新建作品
        </Button>
      </div>

      <div className="story-grid">
        {works.map((work) => (
          <Card key={work.id} shadow="sm" className="story-card">
            <CardHeader className="story-card-header">
              <div>
                <h2>{work.title}</h2>
                <p>更新于 {work.updated_at}</p>
              </div>
              <Chip color="primary" variant="flat">
                {work.status}
              </Chip>
            </CardHeader>
            <CardBody className="story-card-body">
              <p>{work.summary || "尚未填写作品简介。"}</p>
              <div className="story-actions">
                <Chip size="sm" variant="flat">
                  {work.total_word_count.toLocaleString()} 字
                </Chip>
                <Button
                  isIconOnly
                  size="sm"
                  color="danger"
                  variant="light"
                  aria-label="删除作品"
                  onPress={() => setPendingDelete(work)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {!works.length && (
        <div className="empty-state">
          <h2>还没有作品</h2>
          <p>点击右上角“新建作品”开始创作。</p>
        </div>
      )}

      <Modal isOpen={createModal.isOpen} onOpenChange={createModal.onOpenChange}>
        <ModalContent>
          <ModalHeader>新建作品</ModalHeader>
          <ModalBody className="modal-form">
            <Input label="作品名称" value={title} onValueChange={setTitle} />
            <Textarea label="作品简介" minRows={4} value={summary} onValueChange={setSummary} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={createModal.onClose}>
              取消
            </Button>
            <Button color="primary" onPress={() => void handleCreate()}>
              创建作品
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="删除作品"
        body={`确定要删除作品「${pendingDelete?.title ?? ""}」吗？此操作不可恢复。`}
        confirmLabel="删除"
        danger
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
