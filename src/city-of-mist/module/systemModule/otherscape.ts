import { CityItemSheetSmall } from "../city-item-sheet.js";
import { ThemeTypeInfo } from "./baseSystemModule.js";
import { RollDialog } from "../roll-dialog.js";
import { MistRoll } from "../mist-roll.js";
import { localize } from "../city.js";
import { CityDB } from "../city-db.js";
import { Themebook } from "../city-item.js";
import { CitySettings } from "../settings.js";
import { Essence } from "../city-item.js";
import { CityActor, PC } from "../city-actor.js";
import { Theme } from "../city-item.js";
import { MistEngineSystem } from "./mist-engine.js";

const PATH = "systems/city-of-mist";

export class OtherscapeSystem extends MistEngineSystem {

	protected override themeCardTemplate = "systems/city-of-mist/templates/otherscape/theme-card.hbs";

	override get localizationStarterName() {
		return "Otherscape" as const;
	}

	override async downtimeTemplate(actor: CityActor): Promise<string> {
		const templateData ={actor};
		return await renderTemplate(`${PATH}/templates/dialogs/pc-downtime-chooser-otherscape.hbs`, templateData);
	}

	get name(){ return "otherscape" as const;}
	get localizationString() { return localize("CityOfMist.settings.system.1");}

	headerTable = {
		character: "systems/city-of-mist/templates/otherscape/pc-sheet-header.hbs",
		threat: "",
		crew: ""
	}

	override themeTypes() {
		return {
			"Loadout": {
				localization: "Otherscape.terms.loadoutTheme.name",
				sortOrder: 100,
				increaseLocalization: "Otherscape.terms.upgrade",
				decreaseLocalization: "Otherscape.terms.decay",
				identityName: "Otherscape.terms.crewIdentity",
				specials: ["loadout"],
			},
			"Noise": {
				localization:	"Otherscape.terms.noise",
				sortOrder: 2,
				increaseLocalization: "Otherscape.terms.upgrade",
				decreaseLocalization: "Otherscape.terms.decay",
				identityName: "Otherscape.terms.itch",
			},
			"Self": {
				localization: "Otherscape.terms.self",
				sortOrder: 3,
				increaseLocalization: "Otherscape.terms.upgrade",
				decreaseLocalization: "Otherscape.terms.decay",
				identityName: "Otherscape.terms.identity",
			},
			"Mythos-OS": {
				localization: "Otherscape.terms.mythos",
				sortOrder: 1,
				increaseLocalization: "Otherscape.terms.upgrade",
				decreaseLocalization: "Otherscape.terms.decay",
				identityName: "Otherscape.terms.ritual",
			},
			//rewriting mythos is necessary due to a bug with older versions
			"Mythos": {
				localization: "Otherscape.terms.mythos",
				sortOrder: 1,
				increaseLocalization: "Otherscape.terms.upgrade",
				decreaseLocalization: "Otherscape.terms.decay",
				identityName: "Otherscape.terms.ritual",
			},
			"Crew-OS": {
				localization: "Otherscape.terms.crew",
				sortOrder: 5,
				increaseLocalization: "Otherscape.terms.upgrade",
				decreaseLocalization: "Otherscape.terms.decay",
				identityName: "Otherscape.terms.crewIdentity",
				specials: ["crew"],

			}
		} as const satisfies Record<string, ThemeTypeInfo>;
	}

	override async onChangeTo() : Promise<void> {
		await super.onChangeTo();
		const settings = CitySettings;
		await settings.set("baseSystem", "otherscape");
		await settings.set("system", "otherscape");
		await settings.set( "movesInclude", "otherscape");
	}

	async determineEssence(actor : PC) {
		if (!CitySettings.get("autoEssence")) return;
		const essence = OtherscapeSystem.determineEssenceFromThemes(actor.mainThemes);
		if (essence) {
			await actor.setEssence(essence);
		}
		return essence;
	}

	static determineEssenceFromThemes(themes: Theme[]) : Essence | undefined {

		const themeTypes = themes.reduce(
			(acc, theme) => {
				const themeType = theme.getThemebook()!.system.subtype;
				if (acc.includes(themeType) || !themeType) return acc;
				acc.push(themeType);
				return acc;
			}
			, [] as Themebook["system"]["subtype"][] );
		let essence : Essence | undefined = undefined;
		switch (themeTypes.length) {
			case 0: return;
			case 1:
				switch (themeTypes[0]) {
					case "Noise":
						return CityDB.getEssenceBySystemName("Singularity");
					case "Self":
						return CityDB.getEssenceBySystemName("Real");
					case "Mythos":
						return; //can't defuined essence
				}
			case 2:
				switch (true) {
					case !themeTypes.includes("Mythos"): {
						return CityDB.getEssenceBySystemName("Cyborg");
					}
					case !themeTypes.includes("Noise"): {
						return CityDB.getEssenceBySystemName("Spiritualist");
					}
					case !themeTypes.includes("Self"): {
						return CityDB.getEssenceBySystemName("Transhuman");
					}
				}
				break;
			case 3:
				return CityDB.getEssenceBySystemName("Nexus");
			default:
				break;
		}
		return essence;
	}

	override async activate() {
		super.activate();
		for (const [name, data] of Object.entries(this.systemSettings())) {
			game.settings.register("city-of-mist", name, data);
		}
	}

	 override async registerItemSheets() {
		 super.registerItemSheets();
	Items.registerSheet("city", CityItemSheetSmall, {types: ["essence"], makeDefault: true});
	 }

	protected override async _setHooks () {
		super._setHooks();
		Hooks.on("themeCreated", async (actor, theme) => {
			if (!this.isActive()) return;
			if (actor.system.type != "character") return;
			if (actor.mainThemes.length < 4) return;
			//Nexus Theme Effect
			const oldEssence = actor.essence;
			const newEssence = await this.determineEssence(actor as PC);
			if (newEssence == undefined) {
				console.log(`Unable to determine essence for ${actor.name}`);
				return;
			}
			if (actor.isOwner && oldEssence?.system.systemName == "Nexus" && newEssence?.systemName == "Nexus") {
				await theme.update({ "system.nascent": false});
			}
		});
	}

	getEssence(actor: CityActor) : keyof EssenceNames | undefined {
		return actor.essence?.system.systemName as keyof EssenceNames;
	}


	override async updateRollOptions( html: JQuery, options: Partial<MistRoll["options"]>, dialog: RollDialog) {
		await super.updateRollOptions(html, options, dialog);
		const essence = this.getEssence(dialog.actor);
		const self = $(html).find("#add-self").prop("checked");
		const mythos = $(html).find("#add-mythos").prop("checked")
			const noise = $(html).find("#add-noise").prop("checked")
		const tt : MistRoll["options"]["themeTypes"] = [] ;
		if (self) { tt.push("Self");}
		if (mythos) { tt.push("Mythos");}
		if (noise) { tt.push("Noise");}
		if (essence  == "Real" && self) {
			options.noPositiveTags = true;
		}
		options.themeTypes = tt;
	}

	override async renderRollDialog( dialog: RollDialog) {
		await super.renderRollDialog(dialog);
		const essence = this.getEssence(dialog.actor);
		const move = CityDB.getMoveById(dialog.move_id);
		if (!move) return;
		if (move.system.category == "SHB") return;
		const selfLoc = localize("Otherscape.dialog.addSelf");
		const mythosLoc = localize("Otherscape.dialog.addMythos");
		const noiseLoc = localize("Otherscape.dialog.addNoise");
		const selfCheck = `
		<div>
		<label class="dialog-label" for="add-self"> ${selfLoc} </label>
		<input id="add-self" type="checkbox" ${false ? "checked": ""} >
		</div>
		`;
		const mythosCheck = `
		<div>
		<label class="dialog-label" for="add-mythos"> ${mythosLoc} </label>
		<input id="add-mythos" type="checkbox" ${false ? "checked": ""} >
		</div>
`;
		const noiseCheck = `
		<div>
		<label class="dialog-label" for="add-noise"> ${noiseLoc} </label>
		<input id="add-noise" type="checkbox" ${false ? "checked": ""} >
		</div>
`;
		switch (essence) {
			case "Spiritualist":  {
				const element = `
				<div>
					${selfCheck}
					${mythosCheck}
				</div>
				`;
				dialog.html.find(".essence-effects").append(element);
				break;
			}
			case "Cyborg": {
				const element = `;
				<div>
					${noiseCheck}
					${selfCheck}
					</div>
				`;
				dialog.html.find(".essence-effects").append(element);
				break;
			}
			case "Real": {
				const element = `<div>${selfCheck}</div>`;
				dialog.html.find(".essence-effects").append(element);
				break;
			}
			case "Singularity": {
				const element = `<div>${noiseCheck}</div>`;
				dialog.html.find(".essence-effects").append(element);
				break;
			}
			case "Nexus":
			case "Conduit":
			case "Avatar":
			case "Transhuman":
			case undefined:
				break;
			default:
				essence satisfies never;
		}
	}

	override systemSettings() : OTHERSETTINGS {
		return {
			...super.systemSettings(),
			"autoEssence": {
				name: localize("Otherscape.settings.autoEssence.name"),
				hint: localize("Otherscape.settings.autoEssence.hint"),
				scope: "client",
				config: true,
				type: Boolean,
				default: true,
				restricted: false
			}
		} as const;
	}
}

declare global {

	interface SYSTEM_NAMES {
		"otherscape": string;
	}
	interface ThemeTypes extends Omit<ReturnType<OtherscapeSystem["themeTypes"]>, "Mythos"> { }

	interface EssenceNames {
		Singularity: {}; // all noise
		Conduit: {}; //all mythos (difftype)
		Avatar: {}; //all mythos (same type)
		Cyborg: {}; //self + noise
		Nexus: {}; //three types
		Real : {}; //all self
		Transhuman: {}; // mythos + noise
		Spiritualist: {}; //self +mythos
	}

	interface OTHERSETTINGS extends Record<string & {}, SelectSettings>  {
		"autoEssence": {
				name: string,
				hint: string,
				scope: "client",
				config: true,
				type: BooleanConstructor,
				default: true,
				restricted: false
		}
	}
}

