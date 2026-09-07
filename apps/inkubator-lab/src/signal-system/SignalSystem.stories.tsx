import type {Meta, StoryObj} from '@storybook/react-vite';
import GoldenScreens from './GoldenScreens';

const meta = {
  title: 'REKT Signal System/Golden Screens',
  component: GoldenScreens,
  parameters: {layout: 'fullscreen'},
} satisfies Meta<typeof GoldenScreens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const World: Story = {args: {screen: 'world'}};
export const Command: Story = {args: {screen: 'command'}};
export const Project: Story = {args: {screen: 'project'}};
export const Player: Story = {args: {screen: 'player'}};
export const Ship: Story = {args: {screen: 'ship'}};
