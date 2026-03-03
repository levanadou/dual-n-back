# Dual N-back (双重记忆训练)

这是一个基于 React + Vite + Tailwind CSS 开发的双重 N-back (Dual N-back) 训练应用。

## 功能特点
- **双重刺激**：同时进行位置（视觉）和声音（听觉）的记忆训练。
- **自动升降级**：根据表现自动调整难度（错误 ≤ 3 晋级，错误 ≥ 7 降级）。
- **手动选级**：支持在主页面手动选择初始 N 级。
- **实时反馈**：训练过程中显示进度，结束后生成详细的统计报告。
- **响应式设计**：支持电脑快捷键（F/J）和手机端触屏操作。

## 本地开发

1. 克隆仓库：
   ```bash
   git clone <your-repo-url>
   cd dual-n-back
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

## 部署到 Vercel

1. 将代码推送到 GitHub。
2. 在 [Vercel 控制台](https://vercel.com) 点击 "Add New" -> "Project"。
3. 导入你的 GitHub 仓库。
4. 框架预设选择 **Vite**。
5. 点击 **Deploy** 即可。

## 技术栈
- React 18
- Vite
- Tailwind CSS
- Lucide React (图标)
- Recharts (图表统计)
- Framer Motion (动画效果)
