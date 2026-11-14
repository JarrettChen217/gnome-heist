// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T11a).
// The Worker reads the same map file as the client, through the same core/loadFarm.
import { loadFarm } from '@gnome-heist/core';
import farmText from '@gnome-heist/maps/farm.tmj';

export const FARM = loadFarm(JSON.parse(farmText));
export const MAP_VERSION = FARM.mapVersion;
